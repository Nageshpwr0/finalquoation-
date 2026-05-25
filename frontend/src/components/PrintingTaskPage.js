import React, { useEffect, useMemo, useState } from 'react';
import BloomSelect from './BloomSelect';
import '../design-system.css';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { generatePdf } from './JobCardPDF';
import { taskActorUsername, printingTaskSliceActive, mergeHandledByStrings } from '../utils/taskManagerAudit';
import {
  buildPrintingTaskRowsFromInwards,
  getFormShortCode,
  getTypeMultiplier,
  calculateOriginalImpression,
} from '../utils/printingTaskRowBuilder';
import { getTaskRowBackground } from '../utils/jobCardPriorityStyle';

const canonicalMachineFilterLabel = (value) => (
  String(value || '')
    .replace(/\b\d+\s*clr\b/gi, '')
    .replace(/\b\d+\s*color\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
);

if (!document.querySelector('#printing-task-table-fix-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'printing-task-table-fix-styles';
  styleSheet.textContent = `
    .printing-task-page {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      padding: 16px !important;
    }
    .printing-task-page .cuttosheet-box {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      padding: 18px !important;
    }
    .printing-task-table-wrap {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .printing-task-table.result-table-modern {
      table-layout: auto !important;
      width: 100% !important;
      min-width: 100% !important;
      border-collapse: collapse;
    }
    .printing-task-table.result-table-modern th,
    .printing-task-table.result-table-modern td {
      width: auto !important;
      min-width: 60px;
      padding: 8px 10px;
      white-space: nowrap;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .printing-task-table.result-table-modern th[colspan] {
      text-align: center;
    }
    .printing-task-table.result-table-modern tbody td[colspan] {
      white-space: normal;
      text-align: center;
      padding: 14px 10px;
      color: #6b7280;
    }
    .printing-task-table.result-table-modern th:nth-child(n),
    .printing-task-table.result-table-modern td:nth-child(n) {
      width: auto !important;
    }
  `;
  document.head.appendChild(styleSheet);
}

const PrintingTaskPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [machineFilter, setMachineFilter] = useState('all');
  const [machineMasterOptions, setMachineMasterOptions] = useState([]);
  const [enterQtyByJob, setEnterQtyByJob] = useState({});
  const [savedInlineRows, setSavedInlineRows] = useState({});
  const [impressionByJob, setImpressionByJob] = useState({});
  const [inlineMessage, setInlineMessage] = useState('');
  const [startedJobs, setStartedJobs] = useState({});
  const [endedJobCards, setEndedJobCards] = useState([]);
  const [endedRowKeys, setEndedRowKeys] = useState([]);

  const parseTaskManager = (taskManagerRaw) => {
    if (!taskManagerRaw) return {};
    if (typeof taskManagerRaw === 'string') {
      try { return JSON.parse(taskManagerRaw) || {}; } catch (_) { return {}; }
    }
    return typeof taskManagerRaw === 'object' ? taskManagerRaw : {};
  };

  const persistPrintingTaskToDb = async (jobCardNo, patchPrintingTaskStateMachines, printingWorkflowStatus) => {
    const key = String(jobCardNo || '').trim();
    if (!key) return;
    try {
      const listRes = await api.get('/jobcards');
      const jobs = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
      const job = jobs.find((j) => String(j?.jobCardNum || '').trim() === key);
      if (!job?.id) return;
      const latestRes = await api.get(`/jobcards/${job.id}`);
      const latest = latestRes?.data?.data || job;
      const tm = parseTaskManager(latest.taskManager);
      const actor = taskActorUsername(user);
      const prevPts = tm.printingTaskState && typeof tm.printingTaskState === 'object'
        ? tm.printingTaskState
        : { machines: {} };
      const patch = patchPrintingTaskStateMachines || {};
      const nextMachines = { ...(prevPts.machines || {}) };
      Object.entries(patch).forEach(([k, v]) => {
        const prevM = nextMachines[k] || {};
        const merged = { ...prevM, ...v };
        if (actor) {
          merged.updatedBy = actor;
          merged.handledByUsers = mergeHandledByStrings(prevM.handledByUsers, v?.handledByUsers, actor);
        }
        nextMachines[k] = merged;
      });
      const ts = new Date().toISOString();
      const nextPts = {
        ...prevPts,
        machines: nextMachines,
        updatedAt: ts,
      };
      if (actor) {
        nextPts.updatedBy = actor;
        nextPts.handledByUsers = mergeHandledByStrings(prevPts.handledByUsers, actor);
      }
      const nextTaskManager = {
        ...tm,
        printingTaskState: nextPts,
      };
      if (printingWorkflowStatus) {
        const status = printingWorkflowStatus;
        const stampWorkflowSlice = (sliceKey) => {
          const slice = nextTaskManager[sliceKey];
          if (!slice || typeof slice !== 'object') return;
          if (!printingTaskSliceActive(slice)) return;
          const next = { ...slice, status, updatedAt: ts };
          if (actor) {
            next.updatedBy = actor;
            next.handledByUsers = mergeHandledByStrings(slice.handledByUsers, actor);
          }
          nextTaskManager[sliceKey] = next;
        };
        stampWorkflowSlice('printing');
        stampWorkflowSlice('printing2');
      } else if (actor && Object.keys(patch).length > 0) {
        const stampPrintingSlice = (sliceKey) => {
          const slice = nextTaskManager[sliceKey];
          if (!slice) return;
          if (!printingTaskSliceActive(slice)) return;
          nextTaskManager[sliceKey] = {
            ...slice,
            updatedAt: ts,
            updatedBy: actor,
            handledByUsers: mergeHandledByStrings(slice.handledByUsers, actor),
          };
        };
        stampPrintingSlice('printing');
        stampPrintingSlice('printing2');
      }
      await api.put(`/jobcards/${latest.id}`, { ...latest, taskManager: nextTaskManager });
    } catch (error) {
      console.error('Failed to persist printing task', error);
    }
  };

  const buildMachinePersistPayload = (rowKey, processRows, enterMap, savedMap, impressionTotal) => {
    const rk = String(rowKey || '');
    const rowsEnter = Array.isArray(enterMap[rk]) ? enterMap[rk] : [];
    const lines = (Array.isArray(processRows) ? processRows : []).map((p, idx) => {
      const lineEnter = rowsEnter[idx] || {};
      const sk = `${rk}-${idx}`;
      const saved = savedMap[sk];
      return {
        formCount: lineEnter.formCount ?? '',
        qty: lineEnter.qty ?? '',
        formType: lineEnter.formType ?? getFormShortCode(p?.forms),
        impression: Number(saved?.impression || 0) || 0,
        saved: !!saved?.saved,
      };
    });
    return {
      lines,
      totalImpression: Number(impressionTotal || 0) || 0,
    };
  };

  const normalizeJobCardKey = (value) => String(value || '').trim();

  const getEnterQtyRows = (rowKey, processRows = []) => {
    const existing = Array.isArray(enterQtyByJob[rowKey]) ? enterQtyByJob[rowKey] : [];
    return processRows.map((p, idx) => ({
      formCount: existing[idx]?.formCount ?? String(p?.formCount || ''),
      qty: existing[idx]?.qty ?? '',
      formType: existing[idx]?.formType ?? getFormShortCode(p?.forms),
    }));
  };

  const updateEnterQtyRow = (rowKey, idx, field, value, processRows = [], originalImpression = 0) => {
    const currentRows = getEnterQtyRows(rowKey, processRows);
    const nextRow = { ...(currentRows[idx] || {}), [field]: value };
    const nextFormCount = Number(nextRow.formCount || 0);
    const nextQty = Number(nextRow.qty || 0);
    const nextMultiplier = getTypeMultiplier(nextRow.formType);
    const nextLineImpression = (nextFormCount > 0 && nextQty > 0) ? (nextFormCount * nextQty * nextMultiplier) : 0;
    const lineOriginalImpression = Number(processRows[idx]?.originalImpression || 0);

    if (lineOriginalImpression > 0 && nextLineImpression > lineOriginalImpression) {
      setInlineMessage(`Max allowed for this form row is ${lineOriginalImpression}.`);
      window.setTimeout(() => setInlineMessage(''), 2500);
      return;
    }

    const otherSavedTotal = currentRows.reduce((sum, _line, lineIdx) => {
      if (lineIdx === idx) return sum;
      const lineKey = `${rowKey}-${lineIdx}`;
      return sum + (Number(savedInlineRows[lineKey]?.impression || 0) || 0);
    }, 0);
    const maxAllowedForLine = Math.max(0, Number(originalImpression || 0) - otherSavedTotal);
    if (Number(originalImpression || 0) > 0 && nextLineImpression > maxAllowedForLine) {
      setInlineMessage(`Max allowed impression for this line is ${maxAllowedForLine} (Job Card limit: ${originalImpression}).`);
      window.setTimeout(() => setInlineMessage(''), 2500);
      return;
    }

    currentRows[idx] = nextRow;
    setEnterQtyByJob((prev) => ({ ...prev, [rowKey]: currentRows }));
  };

  const saveInlineRow = async (rowKey, idx, processRows = [], originalImpression = 0, jobCardNo) => {
    const currentRows = getEnterQtyRows(rowKey, processRows);
    const row = currentRows[idx] || {};
    const formCount = Number(row.formCount || 0);
    const enteredQty = Number(row.qty || 0);
    if (!(formCount > 0) || !(enteredQty > 0)) return;
    const multiplier = getTypeMultiplier(row.formType);
    const lineImpression = formCount * enteredQty * multiplier;
    const key = `${rowKey}-${idx}`;
    const lineOriginalImpression = Number(processRows[idx]?.originalImpression || 0);

    if (lineOriginalImpression > 0 && lineImpression > lineOriginalImpression) {
      setInlineMessage(`Cannot save. This line impression (${lineImpression}) exceeds row max ${lineOriginalImpression}.`);
      window.setTimeout(() => setInlineMessage(''), 3000);
      return;
    }

    const otherSavedTotal = currentRows.reduce((sum, _line, lineIdx) => {
      if (lineIdx === idx) return sum;
      const lineKey = `${rowKey}-${lineIdx}`;
      return sum + (Number(savedInlineRows[lineKey]?.impression || 0) || 0);
    }, 0);
    const maxAllowedForLine = Math.max(0, Number(originalImpression || 0) - otherSavedTotal);
    if (Number(originalImpression || 0) > 0 && lineImpression > maxAllowedForLine) {
      setInlineMessage(`Cannot save. This line impression (${lineImpression}) exceeds allowed ${maxAllowedForLine}.`);
      window.setTimeout(() => setInlineMessage(''), 3000);
      return;
    }

    const nextSaved = { ...savedInlineRows, [key]: { saved: true, impression: lineImpression } };
    let total = 0;
    currentRows.forEach((line, lineIdx) => {
      const lineKey = `${rowKey}-${lineIdx}`;
      total += Number(nextSaved[lineKey]?.impression || 0);
    });
    if (Number(originalImpression || 0) > 0 && total > Number(originalImpression || 0)) {
      setInlineMessage(`Entered impression (${total}) cannot exceed Job Card impression (${originalImpression}).`);
      window.setTimeout(() => setInlineMessage(''), 3000);
      return;
    }
    const nextEnterForRow = [...currentRows];
    setSavedInlineRows(nextSaved);
    setEnterQtyByJob((prev) => ({ ...prev, [rowKey]: nextEnterForRow }));
    setImpressionByJob((prev) => ({ ...prev, [rowKey]: total, [key]: lineImpression }));

    const canonicalRowKey = String(rowKey || '');
    const rkNorm = normalizeRowKey(canonicalRowKey);
    const mergedEnter = { ...enterQtyByJob, [canonicalRowKey]: nextEnterForRow };
    await persistPrintingTaskToDb(jobCardNo, {
      [canonicalRowKey]: {
        ...buildMachinePersistPayload(canonicalRowKey, processRows, mergedEnter, nextSaved, total),
        started: !!startedJobs[rkNorm],
        ended: endedRowKeys.includes(rkNorm),
      },
    }, null);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [inwardRes, jobRes, machineRes] = await Promise.all([
          api.get('/paperinwards'),
          api.get('/jobcards'),
          api.get('/printingmachines'),
        ]);
        const inwards = Array.isArray(inwardRes.data?.data) ? inwardRes.data.data : [];
        const jobs = Array.isArray(jobRes.data?.data) ? jobRes.data.data : [];
        const machines = Array.isArray(machineRes.data?.data) ? machineRes.data.data : [];
        const groupedMachineNames = Array.from(new Set(
          machines
            .filter((m) => m && m.machineName)
            .map((m) => canonicalMachineFilterLabel(m.machineName))
            .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b));
        setMachineMasterOptions(groupedMachineNames);
        const out = buildPrintingTaskRowsFromInwards(inwards, jobs);
        setRows(out);

        const jobsByNo = new Map(jobs.map((j) => [String(j?.jobCardNum || '').trim(), j]));
        const nextStarted = {};
        const nextEnded = [];
        const nextEnter = {};
        const nextSaved = {};
        const nextImpression = {};
        out.forEach((row) => {
          const job = jobsByNo.get(String(row.jobCardNo || '').trim());
          if (!job) return;
          const tm = parseTaskManager(job.taskManager);
          const st = tm.printingTaskState?.machines?.[row.rowKey];
          const rkNorm = normalizeRowKey(row.rowKey || row.jobCardNo);
          const printingSlice = printingTaskSliceActive(tm.printing) ? tm.printing : (printingTaskSliceActive(tm.printing2) ? tm.printing2 : null);
          const workflowPrintingStart = String(printingSlice?.status || '').toUpperCase() === 'START';
          if (st?.ended) nextEnded.push(rkNorm);
          if ((st?.started && !st?.ended) || (workflowPrintingStart && !st?.ended)) {
            nextStarted[rkNorm] = true;
          }
          if (!st) return;
          if (Array.isArray(st.lines) && st.lines.length > 0) {
            nextEnter[row.rowKey] = st.lines.map((line, li) => ({
              formCount: line.formCount ?? '',
              qty: line.qty ?? '',
              formType: line.formType ?? getFormShortCode(row.processRows[li]?.forms),
            }));
            st.lines.forEach((line, li) => {
              if (line.saved) {
                nextSaved[`${row.rowKey}-${li}`] = { saved: true, impression: Number(line.impression || 0) };
              }
            });
          }
          if (typeof st.totalImpression === 'number' && st.totalImpression > 0) {
            nextImpression[row.rowKey] = st.totalImpression;
          }
        });
        const nextEndedCards = [];
        const rowsByJob = new Map();
        out.forEach((row) => {
          const jk = normalizeJobCardKey(row.jobCardNo);
          if (!rowsByJob.has(jk)) rowsByJob.set(jk, []);
          rowsByJob.get(jk).push(row);
        });
        rowsByJob.forEach((jobRows, jk) => {
          const job = jobsByNo.get(jk);
          if (!job || jobRows.length === 0) return;
          const tm = parseTaskManager(job.taskManager);
          const machines = tm.printingTaskState?.machines || {};
          const allEnded = jobRows.every((r) => machines[r.rowKey]?.ended);
          if (allEnded) nextEndedCards.push(jobRows[0].jobCardNo);
        });
        setStartedJobs(nextStarted);
        setEndedRowKeys(Array.from(new Set(nextEnded)));
        setEnterQtyByJob(nextEnter);
        setSavedInlineRows(nextSaved);
        setImpressionByJob(nextImpression);
        setEndedJobCards(Array.from(new Set(nextEndedCards.map((n) => normalizeJobCardKey(n)))));
      } catch (err) {
        console.error(err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const normalizeRowKey = (value) => String(value || '').trim().toLowerCase();

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visibleRows = rows
      .filter((r) => !endedRowKeys.includes(normalizeRowKey(r.rowKey || r.jobCardNo)))
      .filter((r) => machineFilter === 'all' || canonicalMachineFilterLabel(r.machineName) === canonicalMachineFilterLabel(machineFilter));
    if (!q) return visibleRows;
    return visibleRows.filter((r) => (
      String(r.jobCardNo || '').toLowerCase().includes(q) ||
      String(r.jobName || '').toLowerCase().includes(q) ||
      String(r.customerName || '').toLowerCase().includes(q) ||
      String(r.inwardNo || '').toLowerCase().includes(q) ||
      String(r.challanNo || '').toLowerCase().includes(q)
    ));
  }, [rows, search, endedRowKeys, machineFilter]);

  const machineOptions = useMemo(() => machineMasterOptions, [machineMasterOptions]);

  const handleStartEndToggle = async (row) => {
    const canonicalRowKey = String(row.rowKey || `${row.jobCardNo}::${row.machineName || ''}`);
    const normalizedRowKey = normalizeRowKey(canonicalRowKey);
    const normalizedJobCardNo = normalizeJobCardKey(row?.jobCardNo);
    const wasStarted = !!startedJobs[normalizedRowKey];

    const nextStarted = { ...startedJobs };
    let nextEnded = [...endedRowKeys];
    let nextEndedCards = [...endedJobCards];

    if (wasStarted) {
      delete nextStarted[normalizedRowKey];
      nextEnded = Array.from(new Set([...nextEnded, normalizedRowKey]));
    } else {
      nextStarted[normalizedRowKey] = true;
      nextEnded = nextEnded.filter((v) => v !== normalizedRowKey);
      nextEndedCards = nextEndedCards.filter((v) => normalizeJobCardKey(v) !== normalizedJobCardNo);
    }

    const jobRowKeys = rows
      .filter((r) => normalizeJobCardKey(r.jobCardNo) === normalizedJobCardNo)
      .map((r) => normalizeRowKey(r.rowKey || r.jobCardNo));
    const allRowsDone = jobRowKeys.length > 0 && jobRowKeys.every((rk) => nextEnded.includes(rk));

    if (wasStarted) {
      if (allRowsDone) {
        nextEndedCards = Array.from(new Set([...nextEndedCards, normalizedJobCardNo]));
      } else {
        nextEndedCards = nextEndedCards.filter((v) => normalizeJobCardKey(v) !== normalizedJobCardNo);
      }
    }

    setStartedJobs(nextStarted);
    setEndedRowKeys(nextEnded);
    setEndedJobCards(nextEndedCards);

    const impTotal = Number(impressionByJob[canonicalRowKey] || impressionByJob[row.rowKey || row.jobCardNo] || 0);
    const machineBody = buildMachinePersistPayload(
      canonicalRowKey,
      row.processRows,
      enterQtyByJob,
      savedInlineRows,
      impTotal,
    );
    await persistPrintingTaskToDb(row.jobCardNo, {
      [canonicalRowKey]: {
        ...machineBody,
        started: !wasStarted,
        ended: wasStarted,
      },
    }, wasStarted ? (allRowsDone ? 'DONE' : 'START') : 'START');
  };

  const handlePrintJobCard = async (jobCardNo) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write('<title>Generating PDF...</title><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666;"><div><h2>Generating PDF, please wait...</h2></div></body>');
    }

    try {
      const listRes = await api.get('/jobcards');
      const jobs = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
      const jobCard = jobs.find((j) => String(j?.jobCardNum || '').trim() === String(jobCardNo).trim());
      if (!jobCard) {
        throw new Error('Job Card not found');
      }

      const [lamRes, intRes, extRes] = await Promise.all([
        api.get('/laminations'),
        api.get('/internalfabrications'),
        api.get('/externalfabrications')
      ]);

      const laminationTypes = Array.isArray(lamRes?.data?.data) ? lamRes.data.data : [];
      const internalFabrications = Array.isArray(intRes?.data?.data) ? intRes.data.data : [];
      const externalFabrications = Array.isArray(extRes?.data?.data) ? extRes.data.data : [];

      let quotationDetails = null;
      if (jobCard.quotationNumber) {
        try {
          const latestQuotationRes = await api.get(`/quotations/${jobCard.quotationNumber}`);
          quotationDetails = latestQuotationRes?.data?.data;
        } catch (_) {}
      }

      if (!quotationDetails && jobCard.quotationDetails) {
        try {
          quotationDetails = typeof jobCard.quotationDetails === 'string' 
            ? JSON.parse(jobCard.quotationDetails) 
            : jobCard.quotationDetails;
        } catch (_) {}
      }

      let taskManager = {};
      if (jobCard.taskManager) {
        try {
          taskManager = typeof jobCard.taskManager === 'string'
            ? JSON.parse(jobCard.taskManager)
            : jobCard.taskManager;
        } catch (_) {}
      }

      const preparedRow = { ...jobCard, quotationDetails, taskManager };
      await generatePdf(preparedRow, laminationTypes, taskManager, internalFabrications, externalFabrications, newWindow);
    } catch (err) {
      console.error('Error generating PDF:', err);
      if (newWindow) {
        newWindow.document.write('<body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#d32f2f;"><div><h2>Error generating PDF. Please close this tab and try again.</h2></div></body>');
      }
    }
  };

  return (
    <div className="dashboard-view printing-task-page" style={{ padding: '20px' }}>
      <div className="cuttosheet-box">
        <h1 className="form-title-pink">Printing Task</h1>
        <div className="form-group" style={{ maxWidth: 420, marginBottom: 12 }}>
          <input
            className="input-box"
            placeholder="Search job card / inward / challan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ maxWidth: 260, marginBottom: 12 }}>
          <BloomSelect
            className="input-box"
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            style={{ margin: 0 }}
          >
            <option value="all">All Machines</option>
            {machineOptions.map((machineName) => (
              <option key={machineName} value={machineName}>
                {machineName}
              </option>
            ))}
          </BloomSelect>
        </div>
        {inlineMessage ? <div style={{ marginBottom: 10, color: '#b42318', fontWeight: 600 }}>{inlineMessage}</div> : null}
        {loading ? (
          <p style={{ margin: 0, color: '#666' }}>Loading printing tasks...</p>
        ) : (
          <div className="printing-task-table-wrap">
            <table className="result-table-modern printing-task-table">
              <thead>
                <tr>
                  <th rowSpan={2}>SR NO.</th>
                  <th rowSpan={2}>MACHINE NAME</th>
                  <th rowSpan={2}>JOB CARD NO</th>
                  <th rowSpan={2}>JOB CARD DATE</th>
                  <th rowSpan={2}>JOB IMAGE</th>
                  <th rowSpan={2}>CUSTOMER NAME</th>
                  <th rowSpan={2}>Qty</th>
                  <th rowSpan={2}>Plate Qty</th>
                  <th colSpan={6}>Forms</th>
                  <th rowSpan={2}>Print</th>
                </tr>
                <tr>
                  <th>Form</th>
                  <th>QTY</th>
                  <th>Type</th>
                  <th>Form Count</th>
                  <th>Enter Qty</th>
                  <th>Impression</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? filteredRows.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ background: getTaskRowBackground(r.jobPriority, undefined) }}
                  >
                    <td>{i + 1}</td>
                    <td>{r.machineName || '-'}</td>
                    <td>{r.jobCardNo || '-'}</td>
                    <td>{r.jobCardDate ? new Date(r.jobCardDate).toLocaleDateString() : '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {r.jobImage ? (
                        <img
                          src={r.jobImage}
                          alt="Job"
                          style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                        />
                      ) : '-'}
                    </td>
                    <td>{r.customerName || '-'}</td>
                    <td>{r.qty || 0}</td>
                    <td>{r.plateQty || '-'}</td>
                    <td>
                      {(Array.isArray(r.processRows) && r.processRows.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.processRows.map((p, idx) => (
                            <div key={`f-${r.id}-${idx}`} style={{ fontSize: 12, lineHeight: 1.2, background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 4, padding: '2px 6px' }}>
                              {p.forms || '-'}
                            </div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {(Array.isArray(r.processRows) && r.processRows.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.processRows.map((p, idx) => (
                            <div key={`q-${r.id}-${idx}`} style={{ fontSize: 12, lineHeight: 1.2, background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 4, padding: '2px 6px', textAlign: 'right' }}>
                              {p.qty || '-'}
                            </div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {(Array.isArray(r.processRows) && r.processRows.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.processRows.map((p, idx) => (
                            <div key={`t-${r.id}-${idx}`} style={{ fontSize: 12, lineHeight: 1.2, background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 4, padding: '2px 6px' }}>
                              {p.type || '-'}
                            </div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {(Array.isArray(r.processRows) && r.processRows.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.processRows.map((p, idx) => (
                            <div key={`f2-${r.id}-${idx}`} style={{ fontSize: 12, lineHeight: 1.2, background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 4, padding: '2px 6px' }}>
                              {p.formCount || '-'}
                            </div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {(Array.isArray(r.processRows) && r.processRows.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {getEnterQtyRows(r.rowKey || r.jobCardNo, r.processRows).map((line, idx) => (
                            <div key={`eq-${r.id}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '86px 120px 100px 76px 106px', gap: 4, background: '#eaf4ff', padding: 4, borderRadius: 6 }}>
                              <input
                                className="input-box"
                                style={{ margin: 0, minWidth: 0, padding: '4px 6px', fontSize: 12 }}
                                placeholder="Count"
                                value={line.formCount}
                                disabled={!startedJobs[normalizeRowKey(r.rowKey || r.jobCardNo)]}
                                onChange={(e) => updateEnterQtyRow(r.rowKey || r.jobCardNo, idx, 'formCount', e.target.value, r.processRows, r.originalImpression)}
                              />
                              <input
                                className="input-box"
                                style={{ margin: 0, minWidth: 0, padding: '4px 6px', fontSize: 12 }}
                                placeholder="Qty"
                                value={line.qty}
                                disabled={!startedJobs[normalizeRowKey(r.rowKey || r.jobCardNo)]}
                                onChange={(e) => updateEnterQtyRow(r.rowKey || r.jobCardNo, idx, 'qty', e.target.value, r.processRows, r.originalImpression)}
                              />
                              <BloomSelect
                                className="input-box"
                                style={{ margin: 0, minWidth: 0, padding: '4px 6px', fontSize: 12 }}
                                value={line.formType}
                                disabled={!startedJobs[normalizeRowKey(r.rowKey || r.jobCardNo)]}
                                onChange={(e) => updateEnterQtyRow(r.rowKey || r.jobCardNo, idx, 'formType', e.target.value, r.processRows, r.originalImpression)}
                              >
                                <option value="FB">FB</option>
                                <option value="SB">SB</option>
                                <option value="DG">DG</option>
                                <option value="OS">OS</option>
                              </BloomSelect>
                              <button
                                type="button"
                                className="save-btn-modern"
                                style={{
                                  margin: 0,
                                  padding: '4px 6px',
                                  fontSize: 11,
                                  opacity: !startedJobs[normalizeRowKey(r.rowKey || r.jobCardNo)] ? 0.7 : 1,
                                  background: savedInlineRows[`${r.rowKey || r.jobCardNo}-${idx}`]?.saved ? '#198754' : undefined,
                                }}
                                disabled={!startedJobs[normalizeRowKey(r.rowKey || r.jobCardNo)]}
                                onClick={() => saveInlineRow(r.rowKey || r.jobCardNo, idx, r.processRows, r.originalImpression, r.jobCardNo)}
                              >
                                {savedInlineRows[`${r.rowKey || r.jobCardNo}-${idx}`]?.saved ? 'Saved' : 'Save'}
                              </button>
                              <input
                                className="input-box"
                                style={{ margin: 0, minWidth: 0, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                                value={savedInlineRows[`${r.rowKey || r.jobCardNo}-${idx}`]?.impression ?? ''}
                                placeholder="Impr."
                                readOnly
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <input className="input-box" style={{ margin: 0, minWidth: 90 }} value="" readOnly />
                      )}
                    </td>
                    <td>{Number(impressionByJob[r.rowKey || r.jobCardNo] || 0) > 0 ? impressionByJob[r.rowKey || r.jobCardNo] : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(() => {
                          const rkNorm = normalizeRowKey(r.rowKey || r.jobCardNo);
                          const isRunning = !!startedJobs[rkNorm];
                          return (
                            <button
                              type="button"
                              className={`save-btn-modern process-task-action-btn ${isRunning ? 'printing-task-action-btn--running' : 'printing-task-action-btn--start'}`}
                              style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700 }}
                              onClick={() => handleStartEndToggle(r)}
                            >
                              {isRunning ? 'END' : 'START'}
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          className="save-btn-secondary"
                          style={{
                            padding: '4px 8px',
                            marginLeft: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            height: '26px',
                            boxSizing: 'border-box'
                          }}
                          title="Print Job Card"
                          onClick={() => handlePrintJobCard(r.jobCardNo)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={16} style={{ textAlign: 'center' }}>
                      No jobs consumed from cutting task yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintingTaskPage;
