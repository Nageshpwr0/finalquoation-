import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import BloomSelect from './BloomSelect';
import JobCardList from './JobCardList';
import { useAuth } from '../contexts/AuthContext';
import { makeAuthenticatedRequest } from '../utils/auth.js';
import {
  resolveFabricationPricingRow,
  getEffectivePerPieceRateForQtyRate,
  calcInternalFabricationAmountWithArea,
  calcExternalFabricationAmount
} from '../utils/internalFabricationCalc';
import {
  externalFabJointTaskKey,
  parseExternalFabJointTaskKey,
  resolveFabIdFromJobTaskKey,
  resolveJobCardFabTaskCategory
} from '../utils/fabricationTaskRouting';
import { resolveCostBreakdownFabCategory } from '../utils/costBreakdownFabSections';
import { getPrintingMachineRate, parseSizeInches, sheetFitsInMax } from '../utils/printingMachinePricing';
import { compareBindingProcessesBySequence } from '../utils/bindingProcessSequenceOrder';
import {
  computeBindingCostFromCustomMaster,
  inferBindingJobPaperSizeInches,
} from '../utils/bindingMasterCustomCost';
import { parseInputToInches, parseInchOrMmSizePair } from '../utils/notepadPadsCalcShared';
import { isBookletsProductType } from '../utils/bookletsProduct';
import {
  computeManualJobCardBookletAutoFill,
  parseJobCardPagesInput,
} from '../utils/jobCardManualBookletCalc';
import { requestPlateAutoSelect, resolveAutoRequestPlate } from '../utils/requestPlateAutoSelect';
import {
  formatDispatchDateForInput,
  maskDispatchDateInput,
  parseDispatchDateInputToIso,
} from '../utils/dispatchDateFormat';
import { getJobCardTaskBloomTone, getTaskStatusBloomBadgeClass } from '../utils/jobCardTaskBloomTone';
import {
  getTaskManagerEditLockState,
  isTaskKeyLockedForEditing,
} from '../utils/taskManagerEditLock';
import { machineAppliesToPrintingType } from '../utils/printJobPrintingTypes';
import { resolveCoverPrintingColorForJobCardForm } from '../utils/jobCardCoverColor';
import '../design-system.css';
import './job-card-quotation-search.css';

const JOB_CARD_COLOR_OPTIONS = [
  { value: '', label: 'Select Color' },
  { value: 'bothsides', label: 'Both Sides (4+4 Color)' },
  { value: 'oneside', label: 'One Side (4+0 Color)' },
  { value: 'bothsides2', label: 'Both Sides (2+2 Color)' },
  { value: 'oneside2', label: 'One Side (2+0 Color)' },
  { value: 'bothsides1', label: 'Both Sides (1+1 Color)' },
  { value: 'oneside1', label: 'One Side (1+0 Color)' },
  { value: 'pantone_cmyk_bs', label: 'Pantone+CMYK B/S' },
  { value: 'pantone_cmyk_os', label: 'Pantone+CMYK O/S' },
  { value: 'pantone_bs', label: 'Pantone B/S' },
  { value: 'pantone_os', label: 'Pantone O/S' },
  { value: 'multi', label: 'Multi-Color' },
  { value: 'single', label: 'Single Color' },
  { value: '2+2', label: '2+2 Color' },
  { value: 'common-ruled-4+4', label: 'Common or ruled 4+4' },
  { value: 'common-ruled-2+2', label: 'Common or ruled 2+2' },
  { value: 'common-ruled-1+1', label: 'Common or ruled 1+1' },
  { value: 'common-ruled-4+0', label: 'Common or ruled 4+0' },
  { value: 'common-ruled-2+0', label: 'Common or ruled 2+0' },
  { value: 'common-ruled-1+0', label: 'Common or ruled 1+0' },
];

function resolveCoverPrintingColorFromInputs(inputs = {}) {
  return (
    inputs.bookletCoverPrinting
    || inputs.padCoverPrinting
    || inputs.visualateCoverPrinting
    || inputs.coverPrintingColor
    || ''
  );
}

/** Process row part: inner vs cover (stored in processDetails.type). */
function isProcessRowCover(type) {
  return String(type || '').trim().toLowerCase() === 'cover';
}

function processRowTypeToSelectValue(type) {
  if (isProcessRowCover(type)) return 'cover';
  const t = String(type || '').trim().toLowerCase();
  if (t === 'inner' || t === 'main job') return 'inner';
  return '';
}

const JOB_CARD_STANDARD_SIZE_PRESETS = {
  A4: { w: '8.27', h: '11.69' },
  A5: { w: '5.83', h: '8.27' },
  A6: { w: '4.13', h: '5.83' },
  Letter: { w: '8.5', h: '11' },
  'Half-Letter': { w: '5.5', h: '8.5' },
  '7x9.5': { w: '7', h: '9.5' },
  '7x4.75': { w: '7', h: '4.75' },
  '9.5x13.5': { w: '9.5', h: '13.5' },
  '9x9': { w: '9', h: '9' },
  '8x8': { w: '8', h: '8' },
};

function formatJobCardInchDisplay(inches) {
  const n = Math.round(Number(inches) * 100) / 100;
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}

/** Quotation may store job width/height in mm (e.g. 148mm, 210) or inches (8.27). */
function parseJobDimensionToInches(value) {
  if (value == null || value === '') return 0;
  const str = String(value).trim().toLowerCase();
  if (str.endsWith('mm')) {
    return parseInputToInches(value);
  }
  const n = parseFloat(str);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 50) return n / 25.4;
  return n;
}

function presetLabelForInches(wIn, hIn) {
  if (!(wIn > 0) || !(hIn > 0)) return null;
  const tol = 0.25;
  for (const [label, dims] of Object.entries(JOB_CARD_STANDARD_SIZE_PRESETS)) {
    const dw = parseFloat(dims.w);
    const dh = parseFloat(dims.h);
    if (
      (Math.abs(dw - wIn) < tol && Math.abs(dh - hIn) < tol) ||
      (Math.abs(dw - hIn) < tol && Math.abs(dh - wIn) < tol)
    ) {
      return label;
    }
  }
  return null;
}

function resolveAutofilledJobCardSizeFromQuotation(inputs) {
  const wIn = parseJobDimensionToInches(inputs?.jobWidth ?? inputs?.width);
  const hIn = parseJobDimensionToInches(inputs?.jobHeight ?? inputs?.height);
  if (wIn > 0 && hIn > 0) {
    const preset = presetLabelForInches(wIn, hIn);
    if (preset) return preset;
    return `${formatJobCardInchDisplay(wIn)}x${formatJobCardInchDisplay(hIn)}`;
  }

  const named = String(inputs?.size || inputs?.paperSize || inputs?.standardSize || '').trim();
  if (named && JOB_CARD_STANDARD_SIZE_PRESETS[named]) {
    return named;
  }

  const pair = parseInchOrMmSizePair(named);
  if (pair?.w > 0 && pair?.h > 0) {
    const preset = presetLabelForInches(pair.w, pair.h);
    if (preset) return preset;
    return `${formatJobCardInchDisplay(pair.w)}x${formatJobCardInchDisplay(pair.h)}`;
  }

  if (!named) return '— Custom —';

  const standardSizesList = Object.keys(JOB_CARD_STANDARD_SIZE_PRESETS);
  const isInchDimensions = /^\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?$/i.test(named);
  if (standardSizesList.includes(named) || isInchDimensions) {
    return named;
  }

  const loose = named.replace(/\s*mm\s*/gi, '').trim();
  const loosePair = parseInchOrMmSizePair(loose);
  if (loosePair?.w > 0 && loosePair?.h > 0) {
    return `${formatJobCardInchDisplay(loosePair.w)}x${formatJobCardInchDisplay(loosePair.h)}`;
  }

  return '— Custom —';
}

function parseJobCardSizeToDimensions(sizeStr) {
  const s = String(sizeStr || '').trim();
  if (!s || s === '— Custom —') return { w: '', h: '' };
  const preset = JOB_CARD_STANDARD_SIZE_PRESETS[s];
  if (preset) return { w: preset.w, h: preset.h };
  const pair = parseInchOrMmSizePair(s.replace(/\s*mm\s*/gi, ''));
  if (pair?.w > 0 && pair?.h > 0) {
    return {
      w: formatJobCardInchDisplay(pair.w),
      h: formatJobCardInchDisplay(pair.h),
    };
  }
  const m = s.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)$/i);
  if (m) return { w: m[1], h: m[2] };

  // Fallback for partial/in-progress inputs (so user can type)
  if (s.includes('x') || s.includes('X') || s.includes('×')) {
    const parts = s.split(/[xX×]/);
    const w = parts[0] ? parts[0].trim() : '';
    const h = parts[1] ? parts[1].trim() : '';
    return { w, h };
  }

  // If it's just a number or partial decimal, treat it as width
  if (/^\d*\.?\d*$/.test(s)) {
    return { w: s, h: '' };
  }

  return { w: '', h: '' };
}

function formatJobCardSizeFromDimensions(width, height) {
  const w = String(width ?? '').trim();
  const h = String(height ?? '').trim();
  if (!w && !h) return '— Custom —';
  if (w && h) return `${w}x${h}`;
  if (w) return w;
  if (h) return `x${h}`;
  return '— Custom —';
}

function buildJobCardBindingMasterPayload(bindingMaster) {
  return {
    bindingProductRows: bindingMaster?.bindingProductRows || [],
    padBindingProductRows: bindingMaster?.padBindingProductRows || [],
    visualateBindingProductRows: bindingMaster?.visualateBindingProductRows || [],
    hardboundGallyBindingProductRows: bindingMaster?.hardboundGallyBindingProductRows || [],
    processRows: bindingMaster?.processRows || [],
    slabRows: bindingMaster?.slabRows || [],
  };
}

function getJobCardBindingCalcInputs(fd, processRows) {
  const pr = Array.isArray(processRows) ? processRows : [];
  const pages = parseJobCardPagesInput(fd?.pages).innerPages || parseInt(fd?.pages, 10) || 0;
  const gsm = parseFloat(fd?.paperGsm) || 0;
  const ups = parseInt(fd?.ups, 10) || 1;
  const coverGsm = parseFloat(fd?.coverPaperGsm) || 0;

  const totalProcessSheets = pr.reduce((sum, row) => {
    const qty = parseFloat(row?.qty) || 0;
    const extra = parseFloat(row?.extraSheets) || 0;
    return sum + qty + extra;
  }, 0);
  const qtyFromProcess = pr.length > 0 ? parseInt(pr[0]?.qty, 10) || 0 : 0;
  const bindingQty =
    parseInt(fd?.baseQty, 10) ||
    parseInt(fd?.qtyCutSheet, 10) ||
    parseInt(fd?.qtyFullSheet, 10) ||
    qtyFromProcess ||
    totalProcessSheets ||
    0;

  let totalFormCount = pr.reduce((sum, row) => sum + (parseFloat(row?.sideCount) || 0), 0);
  if (totalFormCount <= 0 && pages > 0) {
    const innerFormCount = Math.ceil(pages / 2 / (ups > 0 ? ups : 1));
    const coverFormCount = coverGsm > 0 ? 1 : 0;
    totalFormCount = innerFormCount + coverFormCount;
  }
  if (totalFormCount <= 0) {
    totalFormCount =
      pr.reduce((sum, row) => {
        const fc = parseFloat(row?.sideCount) || 0;
        return sum + (fc > 0 ? fc : 0);
      }, 0) || 1;
  }

  const { w, h } = parseJobCardSizeToDimensions(fd?.size);
  const jobW = parseJobDimensionToInches(w) || parseFloat(w) || 0;
  const jobH = parseJobDimensionToInches(h) || parseFloat(h) || 0;
  const jobPaperSize = jobW > 0 && jobH > 0 ? inferBindingJobPaperSizeInches(jobW, jobH) : '';

  return { bindingQty, totalFormCount, pages, gsm, jobPaperSize };
}

/** Binding task amount + per-process breakdown from Binding Master (pages, forms, qty, size, GSM). */
function computeJobCardBindingTaskAmount(fd, processRows, bindingMaster) {
  const productName = String(fd?.bindingProduct || '').trim();
  if (!productName) return { amount: '', ok: false, breakdown: [] };

  const { bindingQty, totalFormCount, pages, gsm, jobPaperSize } = getJobCardBindingCalcInputs(
    fd,
    processRows
  );
  const result = computeBindingCostFromCustomMaster(
    buildJobCardBindingMasterPayload(bindingMaster),
    productName,
    bindingQty,
    totalFormCount,
    pages,
    gsm,
    jobPaperSize
  );

  if (result.ok && result.bindingCost > 0) {
    return {
      amount: result.bindingCost.toFixed(2),
      ok: true,
      breakdown: result.bindingProcessBreakdown || [],
    };
  }
  return { amount: '', ok: false, breakdown: [] };
}

function formatBindingProcessDisplayAmount(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function isPaperFullSizeStarted(lengthVal, widthVal) {
  return String(lengthVal ?? '').trim() !== '' || String(widthVal ?? '').trim() !== '';
}

function hasPositiveSheetQty(qtyVal) {
  const n = parseFloat(String(qtyVal ?? '').trim());
  return Number.isFinite(n) && n > 0;
}

function validateJobCardPaperQtyBeforeSave(fd, showCoverPaperSection) {
  if (isPaperFullSizeStarted(fd?.paperLength, fd?.paperWidth) && !hasPositiveSheetQty(fd?.qtyFullSheet)) {
    return 'Please enter Sheet Qty (Full Sheet) in Main Paper Details.';
  }
  if (
    showCoverPaperSection
    && isPaperFullSizeStarted(fd?.coverPaperLength, fd?.coverPaperWidth)
    && !hasPositiveSheetQty(fd?.coverQtyFullSheet)
  ) {
    return 'Please enter Cover Sheet Qty (Full Sheet) in Cover Paper Details.';
  }
  return '';
}

function isJobCardUsingQuotation(selectedQuotation, quotationNumber) {
  if (selectedQuotation) return true;
  return String(quotationNumber ?? '').trim() !== '';
}

const paperOptions = [
  { value: "A4", ups: 8 }, { value: "A5", ups: 16 }, { value: "A6", ups: 32 },
  { value: "Letter", ups: 8 }, { value: "Half-Letter", ups: 16 },
  { value: "7.1x9.5", ups: 16 }, { value: "7.1x4.75", ups: 32 },
  { value: "9.5x13.5", ups: 8 }, { value: "9x9", ups: 12 },
  { value: "8x8", ups: 12 }, { value: "12x12", ups: 4 }, { value: "11x11", ups: 4 }
];

function getCutSizeToSheetMapping(cutSize) {
  const cutSizeToSheet = {
    '13x26': { paperLength: 30, paperWidth: 40, ups: 3 },
    '14x26': { paperLength: 30, paperWidth: 40, ups: 3 },
    '15x20': { paperLength: 30, paperWidth: 40, ups: 4 },
    '20x30': { paperLength: 30, paperWidth: 40, ups: 2 },
    '15x25': { paperLength: 30, paperWidth: 40, ups: 3 },
    '20x29.5': { paperLength: 30, paperWidth: 40, ups: 2 },
    '18x23': { paperLength: 23, paperWidth: 36, ups: 2 },
    '12x23': { paperLength: 23, paperWidth: 36, ups: 3 },
    '18x25': { paperLength: 25, paperWidth: 36, ups: 2 },
    '12x25': { paperLength: 25, paperWidth: 36, ups: 3 },
    '19x25': { paperLength: 25, paperWidth: 38, ups: 2 },
    '12.6x25': { paperLength: 25, paperWidth: 38, ups: 3 },
    '13.5x17': { paperLength: 17, paperWidth: 27, ups: 2 },
  };
  return cutSizeToSheet[cutSize] || null;
}

const CUSTOM_CALC_RESULT_META_KEYS = new Set([
  'totalCost', 'baseTotalCost', 'finalRate', 'baseCost', 'postPressCosts',
  'padBookCosts', 'proportionCost', 'internalFabricationAmt', 'internalFabrications',
  'bestFitDetails', 'costBeforeMargin', 'marginPercent', 'marginAmountAdded'
]);

function normalizeFabJointSelectionMapped(jointRows, fabSlotCount) {
  if (!Array.isArray(jointRows) || jointRows.length === 0) return {};
  const n = Math.max(0, parseInt(String(fabSlotCount), 10) || 0);
  if (n <= 0) return normalizeFabJointSelection(jointRows);
  const acc = {};
  jointRows.forEach((item, index) => {
    const selected = typeof item === 'object' ? String(item.type || item.product || item.value || '').trim() : String(item || '').trim();
    if (!selected) return;
    const fabIdx = Math.min(index, n - 1);
    if (acc[fabIdx]) acc[fabIdx] = `${acc[fabIdx]}, ${selected}`;
    else acc[fabIdx] = selected;
  });
  return acc;
}

function getFabJointProductsFromMaster(fab) {
  if (!fab) return [];
  const list = fab.jointProducts ?? fab.jointproducts;
  if (Array.isArray(list)) {
    return list.filter(joint => joint && joint.product);
  }
  if (fab.jointProduct) {
    return [{
      product: fab.jointProduct,
      rate: fab.jointProductRate || 0
    }];
  }
  return [];
}

function normJointKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchJointTypeToMasterProduct(rawType, preferredFabId, masterRows) {
  const raw = String(rawType || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const rawNorm = normJointKey(raw);
  const tryFab = fab => {
    for (const j of getFabJointProductsFromMaster(fab)) {
      const p = String(j.product || '').trim();
      if (!p) continue;
      if (p.toLowerCase() === lower) return p;
      if (normJointKey(p) === rawNorm) return p;
    }
    return null;
  };
  if (preferredFabId != null && String(preferredFabId).trim() !== '') {
    const fab = (masterRows || []).find(f => String(f.id) === String(preferredFabId));
    const hit = tryFab(fab);
    if (hit) return hit;
  }
  for (const fab of masterRows || []) {
    const hit = tryFab(fab);
    if (hit) return hit;
  }
  return raw;
}

function resolveJointProductsMap(jointMap, fabIds, masterRows) {
  if (!jointMap || typeof jointMap !== 'object') return {};
  const out = {};
  Object.keys(jointMap).forEach(k => {
    const idx = parseInt(k, 10);
    if (Number.isNaN(idx)) return;
    const raw = jointMap[k];
    if (raw == null || String(raw).trim() === '') return;
    const fabId = fabIds[idx];
    const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
    const resolved = parts.map(p => matchJointTypeToMasterProduct(p, fabId, masterRows)).join(', ');
    out[String(idx)] = resolved;
  });
  return out;
}

function normalizeFabJointSelection(value) {
  if (!Array.isArray(value)) return {};
  return value.reduce((acc, item, index) => {
    const selected = typeof item === 'object' ? String(item.type || item.product || item.value || '').trim() : String(item || '').trim();
    if (selected) acc[index] = selected;
    return acc;
  }, {});
}

function jointRowHasSelection(item) {
  const selected = typeof item === 'object' ? String(item?.type || item?.product || item?.value || '').trim() : String(item || '').trim();
  return Boolean(selected);
}

function pickQuotationJointRows(resultRows, inputRows) {
  const r = Array.isArray(resultRows) ? resultRows : [];
  const i = Array.isArray(inputRows) ? inputRows : [];
  if (r.some(jointRowHasSelection)) return r;
  if (i.some(jointRowHasSelection)) return i;
  return r.length ? r : i;
}

function pickBookletStyleExternalFabricationRows(selectedOption, inputs) {
  const sources = [inputs, selectedOption].filter(x => x && typeof x === 'object');
  if (sources.length === 0) return [];
  let innerId = null;
  for (const obj of sources) {
    const v = obj.bookletExternalFabrication;
    if (v != null && String(v).trim() !== '' && String(v) !== 'none') {
      innerId = String(v).trim();
      break;
    }
  }
  const coverKeySet = new Set();
  sources.forEach(obj => {
    Object.keys(obj).forEach(k => {
      if (k.startsWith('bookletCoverFab_')) coverKeySet.add(k);
    });
  });
  const sortedCoverKeys = [...coverKeySet].sort((a, b) => {
    const sa = a.slice('bookletCoverFab_'.length);
    const sb = b.slice('bookletCoverFab_'.length);
    const na = Number(sa);
    const nb = Number(sb);
    const aNum = Number.isFinite(na) && String(na) === sa;
    const bNum = Number.isFinite(nb) && String(nb) === sb;
    if (aNum && bNum) return na - nb;
    return sa.localeCompare(sb, undefined, { numeric: true });
  });
  const rows = [];
  if (innerId) rows.push({ id: innerId });
  for (const key of sortedCoverKeys) {
    let val = null;
    for (const obj of sources) {
      const v = obj[key];
      if (v != null && String(v).trim() !== '' && String(v) !== 'none') {
        val = String(v).trim();
        break;
      }
    }
    if (val) rows.push({ id: val });
  }
  return rows;
}

function pickExternalFabricationRowsFromQuotationOption(selectedOption, inputs) {
  const opt = selectedOption && typeof selectedOption === 'object' ? selectedOption : null;
  const inp = inputs && typeof inputs === 'object' ? inputs : {};
  const rowHasFab = x => {
    if (x == null) return false;
    if (typeof x === 'object') {
      return (x.id != null && String(x.id).trim() !== '') || (String(x.product || x.description || x.name || '').trim() !== '');
    }
    return String(x).trim() !== '';
  };
  const nonEmptyArray = a => Array.isArray(a) && a.some(rowHasFab) ? a : null;
  const singleObj = o => o && typeof o === 'object' && !Array.isArray(o) && ((o.id != null && String(o.id).trim() !== '') || (String(o.product || o.description || o.name || '').trim() !== '')) ? [o] : null;
  const fromCutOrEnvelope = nonEmptyArray(opt?.externalFabrications) || nonEmptyArray(inp?.externalFabrications) || nonEmptyArray(inp?.selectedExternalFabrications) || nonEmptyArray(opt?.selectedExternalFabrications) || singleObj(opt?.externalFabrication) || singleObj(inp?.externalFabrication);
  if (fromCutOrEnvelope && fromCutOrEnvelope.length > 0) {
    return fromCutOrEnvelope;
  }
  const fromBookletCustom = pickBookletStyleExternalFabricationRows(opt, inp);
  if (fromBookletCustom.length > 0) {
    return fromBookletCustom;
  }
  return [];
}

function mergeQuotationInputsForJobCard(quotation, selectedOption) {
  if (quotation?.productType === 'Envelope') {
    const base = { ...(quotation?.inputs || {}) };
    const opt = selectedOption && typeof selectedOption === 'object' ? selectedOption : null;
    if (opt) {
      const w = opt.efabAreaWidth ?? opt.efabAreaW;
      const h = opt.efabAreaHeight ?? opt.efabAreaH;
      if ((base.efabAreaWidth == null || String(base.efabAreaWidth).trim() === '') && w != null && String(w).trim() !== '') {
        base.efabAreaWidth = w;
      }
      if ((base.efabAreaHeight == null || String(base.efabAreaHeight).trim() === '') && h != null && String(h).trim() !== '') {
        base.efabAreaHeight = h;
      }
    }
    return base;
  }
  const base = { ...(quotation?.inputs || {}) };
  if (selectedOption?.inputs && typeof selectedOption.inputs === 'object') {
    Object.assign(base, selectedOption.inputs);
  }
  if (isBookletsProductType(quotation?.productType) && selectedOption && typeof selectedOption === 'object') {
    for (const [k, v] of Object.entries(selectedOption)) {
      if (CUSTOM_CALC_RESULT_META_KEYS.has(k) || k === 'inputs') continue;
      base[k] = v;
    }
  }
  const bt = base.bookletBindingType;
  const pt = base.padBindingType;
  if (bt && bt !== 'none' && !base.bindingType) base.bindingType = bt;
  else if (pt && pt !== 'none' && (!base.bindingType || base.bindingType === 'none')) base.bindingType = pt;
  return base;
}

function formatJobCardQuotationOptionLabel(option, optionIndex0) {
  const qtyRaw = option?.qty ?? option?.quantity;
  const qtyDisp = qtyRaw !== undefined && qtyRaw !== null && qtyRaw !== '' ? String(qtyRaw) : 'N/A';
  const amtRaw = option?.finalAmount ?? option?.totalAmount ?? option?.baseTotalAmount ?? option?.amount;
  let amtDisp = 'N/A';
  if (amtRaw !== undefined && amtRaw !== null && amtRaw !== '') {
    const n = typeof amtRaw === 'number' ? amtRaw : parseFloat(String(amtRaw).replace(/,/g, ''));
    amtDisp = Number.isFinite(n) ? n.toFixed(2) : String(amtRaw);
  }
  return `Option ${optionIndex0 + 1} - Qty: ${qtyDisp} - Amount: ₹${amtDisp}`;
}

function buildBookletLayoutInputsForJobCard(quotation, inputs) {
  if (!inputs) return null;
  if (quotation?.productType === 'Booklet') {
    return {
      ...inputs,
      coverPaperType: inputs.coverPaperType || inputs.bookletCoverPaperType || ''
    };
  }
  if (!isBookletsProductType(quotation?.productType)) return null;
  const hasBookletBind = inputs.bookletBindingType && inputs.bookletBindingType !== 'none';
  const hasPadBind = inputs.padBindingType && inputs.padBindingType !== 'none';
  const hasVis = !!inputs.visualateBinding;
  if (!hasBookletBind && !hasPadBind && !hasVis) return null;
  const size = inputs.size || inputs.paperSize || 'A4';
  return {
    ...inputs,
    pages: inputs.noOfLeaves || inputs.pages,
    qty: inputs.qty,
    qty1: inputs.qty,
    size,
    paperSize: size,
    printing: inputs.printing || inputs.printingType,
    printingType: inputs.printingType,
    coverGsm: inputs.bookletCoverGsm || inputs.padCoverGsm || inputs.visualateCoverGsm || inputs.coverGsm,
    coverPrintingColor: inputs.bookletCoverPrinting || inputs.padCoverPrinting || inputs.visualateCoverPrinting || inputs.coverPrintingColor,
    coverLamination: inputs.bookletCoverLamination || inputs.padCoverLamination || inputs.visualateCoverLamination || inputs.coverLamination,
    lamination: inputs.lamination,
    paperType: inputs.paperType,
    gsm: inputs.gsm,
    coverPaperType: inputs.bookletCoverPaperType || inputs.coverPaperType || inputs.padCoverPaperType || ''
  };
}

function getPadBookCoverQuantitiesFromResult(selectedOption) {
  const pb = selectedOption?.padBookCosts;
  if (!pb || !Number(pb.totalCoverSheets) || Number(pb.totalCoverSheets) <= 0) return null;
  const totalCut = Math.round(Number(pb.totalCoverSheets));
  let net = pb.coverSheetsNeeded != null ? Math.round(Number(pb.coverSheetsNeeded)) : null;
  if (net == null || !Number.isFinite(net) || net < 0) net = totalCut;
  let wastage = totalCut - net;
  if (wastage < 0) wastage = 0;
  const parentUps = Number(pb.coverSheet?.parentUps) || 0;
  const printUps = Number(pb.coverUps) || 1;
  const fullSheets = parentUps > 0 ? Math.ceil(totalCut / parentUps) : Math.ceil(totalCut / printUps);
  const method = String(pb.coverPrintingMethod || 'selfback').toLowerCase().replace(/\s+/g, '');
  let forms = 'selfback';
  if (method.includes('frontback')) forms = 'frontback';
  else if (method.includes('doublegripper') || method.includes('double')) forms = 'double_gripper';
  else if (method.includes('oneside')) forms = 'oneside';
  const cs = pb.coverSheet || {};
  return {
    totalCutSheets: totalCut,
    netCutSheets: net,
    wastageSheets: wastage,
    fullSheets,
    forms,
    machineName: cs.machineName || '',
    cutW: cs.cutW,
    cutH: cs.cutH,
    parentW: cs.parentW,
    parentH: cs.parentH,
    parentUps
  };
}

function hydrateTaskManagerFromJobCard(savedRaw) {
  const saved = savedRaw && typeof savedRaw === 'object' ? savedRaw : {};
  const taskDefaults = () => ({
    selected: false,
    machine: '',
    amount: '',
    quotationAmount: '',
    amountSource: 'quotationAmount',
    instructions: '',
    user: '',
    wastageAmount: ''
  });
  const mergeOne = key => {
    const base = taskDefaults();
    const fromSaved = saved[key];
    if (fromSaved && typeof fromSaved === 'object') {
      const extra = {};
      if (fromSaved.fabricationName != null) extra.fabricationName = fromSaved.fabricationName;
      return {
        ...base,
        ...extra,
        ...fromSaved
      };
    }
    return base;
  };
  const out = {
    cutting: mergeOne('cutting'),
    printing: mergeOne('printing'),
    lamination: mergeOne('lamination'),
    binding: mergeOne('binding'),
    billing: mergeOne('billing')
  };
  Object.keys(saved).forEach(k => {
    if (k === 'customOrder' || k === '__customOrder' || k === 'varnishTaskMode') return;
    if (Object.prototype.hasOwnProperty.call(out, k)) return;
    const v = saved[k];
    if (v && typeof v === 'object') {
      const base = taskDefaults();
      if (String(k).startsWith('internalFabrication') || String(k).startsWith('externalFabrication') || String(k).startsWith('externalFabJoint_')) {
        base.fabricationName = v.fabricationName || '';
      }
      out[k] = {
        ...base,
        ...v
      };
    }
  });
  return out;
}

function parseJointProductNamesForJobCard(selected) {
  return String(selected ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

function getJointProductRateFromMasterFab(fab, productName) {
  if (!fab) return 0;
  const name = String(productName || '').trim().toLowerCase();
  if (!name) return 0;
  const list = fab.jointProducts ?? fab.jointproducts;
  if (Array.isArray(list)) {
    const hit = list.find(j => String(j.product || '').trim().toLowerCase() === name);
    if (hit) return parseFloat(hit.rate || 0) || 0;
  }
  if (String(fab.jointProduct || '').trim().toLowerCase() === name) {
    return parseFloat(fab.jointProductRate || 0) || 0;
  }
  return 0;
}

function ensureExternalFabJointTasksInTaskManager(taskManager, formFabState, internalFabrications, externalFabrications) {
  const next = { ...(taskManager || {}) };
  const extIds = Array.isArray(formFabState?.externalFabrications) ? formFabState.externalFabrications : [];
  const jointMap = formFabState?.externalFabricationJointProducts || {};
  const blankTask = () => ({
    selected: true,
    machine: 'EXTERNAL',
    amount: '',
    quotationAmount: '',
    amountSource: 'quotationAmount',
    instructions: '',
    user: '',
    wastageAmount: ''
  });
  extIds.forEach((fabId, idx) => {
    const fab = (externalFabrications || []).find(f => String(f.id) === String(fabId));
    const jointNames = parseJointProductNamesForJobCard(jointMap[idx]);
    jointNames.forEach((jointName, jIdx) => {
      const jKey = externalFabJointTaskKey(idx, jIdx);
      const existing = next[jKey] && typeof next[jKey] === 'object' ? next[jKey] : {};
      const rate = getJointProductRateFromMasterFab(fab, jointName);
      next[jKey] = {
        ...blankTask(),
        ...existing,
        selected: existing.selected !== undefined ? existing.selected : true,
        machine: existing.machine || 'EXTERNAL',
        fabricationName: jointName,
        fabricationId: fabId || existing.fabricationId || '',
        parentExternalFabIndex: idx,
        fabTaskCategory: resolveCostBreakdownFabCategory({ product: jointName }, internalFabrications, externalFabrications),
        amount: existing.amount !== undefined && existing.amount !== '' ? existing.amount : rate ? rate.toFixed(2) : ''
      };
    });
  });
  Object.keys(next).forEach(k => {
    const parsed = parseExternalFabJointTaskKey(k);
    if (!parsed) return;
    const jointNames = parseJointProductNamesForJobCard(jointMap[parsed.parentIdx]);
    if (parsed.jointIdx >= jointNames.length) delete next[k];
  });
  return next;
}

function backfillFabTaskCategoriesOnTaskManager(taskManager, internalFabrications, externalFabrications, job = null) {
  const tm = taskManager && typeof taskManager === 'object' ? { ...taskManager } : {};
  Object.keys(tm).forEach(key => {
    if (!String(key).startsWith('internalFabrication') && !String(key).startsWith('externalFabrication') && !String(key).startsWith('externalFabJoint_')) return;
    const slice = tm[key];
    if (!slice || typeof slice !== 'object') return;
    const fabricationId = slice.fabricationId || resolveFabIdFromJobTaskKey(key, job);
    tm[key] = {
      ...slice,
      ...(fabricationId ? { fabricationId } : {}),
      fabTaskCategory: resolveJobCardFabTaskCategory(slice, internalFabrications, externalFabrications, key, job)
    };
  });
  return tm;
}

function JobCard({
  customers,
  quotations,
  onSaved,
  paperTypes,
  laminationTypes,
  bindings = [],
  internalFabrications = [],
  externalFabrications = [],
  printingMachines = [],
  jobCards = [],
  initialTab,
  onAddCustomer
}) {
  var _selectedQuotation$re, _selectedQuotation$re2;
  const {
    user
  } = useAuth();
  const [showList, setShowList] = useState(initialTab === 'add' ? false : true);
  const [editingJobCard, setEditingJobCard] = useState(null);
  const [processRows, setProcessRows] = useState([{
    remark: '',
    forms: '',
    sideCount: '',
    qty: '',
    extraSheets: '',
    plates: '',
    type: '',
    machine: '',
    lamination: ''
  }]);

  // Task Manager State
  const [taskManager, setTaskManager] = useState({
    cutting: {
      selected: false,
      machine: '',
      amount: '',
      quotationAmount: '',
      amountSource: 'quotationAmount',
      instructions: '',
      user: '',
      wastageAmount: ''
    },
    printing: {
      selected: false,
      machine: '',
      amount: '',
      quotationAmount: '',
      amountSource: 'quotationAmount',
      instructions: '',
      user: '',
      wastageAmount: ''
    },
    lamination: {
      selected: false,
      machine: '',
      amount: '',
      quotationAmount: '',
      amountSource: 'quotationAmount',
      instructions: '',
      user: '',
      wastageAmount: ''
    },
    binding: {
      selected: false,
      machine: '',
      amount: '',
      quotationAmount: '',
      amountSource: 'quotationAmount',
      instructions: '',
      user: '',
      wastageAmount: ''
    },
    billing: {
      selected: true,
      machine: 'INTERNAL',
      amount: '',
      quotationAmount: '',
      amountSource: 'quotationAmount',
      instructions: '',
      user: '',
      wastageAmount: ''
    }
  });
  const [taskOrder, setTaskOrder] = useState([]);
  const [dragTaskName, setDragTaskName] = useState('');
  const [bookletDataLoaded, setBookletDataLoaded] = useState(false);
  const manualBookletAppliedKeyRef = useRef('');
  const [processDetailsAutoFilled, setProcessDetailsAutoFilled] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    quotationNumber: '',
    productName: '',
    selectedOptionIndex: '',
    jobName: '',
    jobCardNum: '',
    pages: '',
    size: '— Custom —',
    poNumber: '',
    imageAttached: '',
    billingType: 'billing',
    sampleAttached: 'no',
    paperLength: '',
    paperWidth: '',
    cutSize: '',
    ups: '',
    qtyFullSheet: '',
    qtyCutSheet: '',
    paperGsm: '',
    paperType: '',
    paperBy: 'us',
    jobColor: '',
    plateBy: 'us',
    jobType: 'new',
    priority: 'regular',
    repeatNo: '',
    requestPlate: 'pc2plate',
    coverPaperLength: '',
    coverPaperWidth: '',
    coverCutSize: '',
    coverUps: '',
    coverQtyFullSheet: '',
    coverQtyCutSheet: '',
    coverPaperGsm: '',
    coverPaperType: '',
    coverPaperBy: 'us',
    coverPrintingColor: '',
    bindingProduct: '',
    bindingProcesses: [],
    internalFabrications: [],
    externalFabrications: [],
    internalFabricationJointProducts: {},
    externalFabricationJointProducts: {},
    posterGumming: false,
    gummingWidth: '',
    gummingHeight: '',
    noOfStrips: '',
    gummingStripType: '',
    dispatchDate: '',
    baseQty: '',
    remark: '',
    varnishTaskMode: '',
    createdBy: ''
  });
  const [dispatchDateDisplay, setDispatchDateDisplay] = useState('');

  useEffect(() => {
    setDispatchDateDisplay(formatDispatchDateForInput(formData.dispatchDate));
  }, [formData.dispatchDate]);

  const [availableQuotations, setAvailableQuotations] = useState([]);
  const [quotationSearch, setQuotationSearch] = useState('');
  const [quotationSearchResults, setQuotationSearchResults] = useState([]);
  const [quotationSearchLoading, setQuotationSearchLoading] = useState(false);
  const [quotationSearchOpen, setQuotationSearchOpen] = useState(false);
  const quotationSearchRef = useRef(null);
  const quotationSearchDebounce = useRef(null);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [showCoverPaper, setShowCoverPaper] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const hasVarnishInProcessRows = useMemo(() => (Array.isArray(processRows) ? processRows : []).some(row => {
    const lam = String((row === null || row === void 0 ? void 0 : row.lamination) || '').toLowerCase();
    return lam.includes('varnish') || lam.includes('varsnish');
  }), [processRows]);
  const varnishTaskRouteOptions = [
    { value: '', label: 'Select' },
    { value: 'printing', label: 'Printing' },
    { value: 'external', label: 'External' },
  ];
  const varnishInstructionLabel = useMemo(() => {
    const labels = (Array.isArray(processRows) ? processRows : []).map(row => String((row === null || row === void 0 ? void 0 : row.lamination) || '').trim()).filter(lam => {
      const key = lam.toLowerCase();
      return key.includes('varnish') || key.includes('varsnish');
    });
    const uniq = Array.from(new Set(labels));
    return uniq.join(' / ') || 'VARNISH';
  }, [processRows]);
  const processMachineSelectOptions = useMemo(() => {
    const options = [];
    const seen = new Set();
    const addName = (name) => {
      const label = String(name || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push(label);
    };
    (printingMachines || []).forEach((m) => {
      if (m && m.isEnabled === false) return;
      if (m && m.isEnabled === 0) return;
      if (String(m?.isEnabled ?? 'true').trim().toLowerCase() === 'false') return;
      if (String(m?.isEnabled ?? '1').trim() === '0') return;
      addName(m?.machineName);
    });
    (processRows || []).forEach((row) => addName(row?.machine));
    return options.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [printingMachines, processRows]);
  const [masterAmountSource, setMasterAmountSource] = useState('amount');
  const [uploadedImageData, setUploadedImageData] = useState('');

  // Local option lists that support dynamic quick-adds
  const [productOptions, setProductOptions] = useState([
    'CutToSheet', 'Booklet', 'Poster', 'Envelope', 'Bag', 'Calendar'
  ]);
  const [billingOptions, setBillingOptions] = useState([
    { value: 'cash', label: 'Cash' },
    { value: 'billing', label: 'Billing' }
  ]);
  const [jobOptions, setJobOptions] = useState([
    { value: 'new', label: 'New' },
    { value: 'repeat', label: 'Repeat' }
  ]);
  const [sampleOptions, setSampleOptions] = useState([
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Yes' }
  ]);

  const handleQuickAddCustomer = async () => {
    const newCust = window.prompt("Enter new Customer Name:");
    if (newCust && newCust.trim()) {
      const cleanName = newCust.trim();
      const exists = customers.some(c => (c.customerName || c.name || '').toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        setFormData(prev => ({ ...prev, customerName: cleanName }));
        alert(`Selected existing customer: ${cleanName}`);
        return;
      }
      try {
        if (typeof onAddCustomer === 'function') {
          await onAddCustomer({ customerName: cleanName, margin: 0 });
          setFormData(prev => ({ ...prev, customerName: cleanName }));
        } else {
          alert("onAddCustomer is not defined, unable to save to backend.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to add customer. Please try again.");
      }
    }
  };

  const handleQuickAddProduct = () => {
    const newProd = window.prompt("Enter new Product Name:");
    if (newProd && newProd.trim()) {
      const cleanProd = newProd.trim();
      if (!productOptions.includes(cleanProd)) {
        setProductOptions(prev => [...prev, cleanProd]);
      }
      setFormData(prev => ({ ...prev, productName: cleanProd }));
    }
  };

  const handleQuickAddBillingType = () => {
    const newBill = window.prompt("Enter new Billing Type:");
    if (newBill && newBill.trim()) {
      const cleanBill = newBill.trim();
      const val = cleanBill.toLowerCase().replace(/\s+/g, '_');
      if (!billingOptions.some(o => o.value === val)) {
        setBillingOptions(prev => [...prev, { value: val, label: cleanBill }]);
      }
      setFormData(prev => ({ ...prev, billingType: val }));
    }
  };

  const handleQuickAddJobType = () => {
    const newJob = window.prompt("Enter new Job Type:");
    if (newJob && newJob.trim()) {
      const cleanJob = newJob.trim();
      const val = cleanJob.toLowerCase().replace(/\s+/g, '_');
      if (!jobOptions.some(o => o.value === val)) {
        setJobOptions(prev => [...prev, { value: val, label: cleanJob }]);
      }
      setFormData(prev => ({ ...prev, jobType: val }));
    }
  };

  const handleQuickAddSample = () => {
    const newSample = window.prompt("Enter new Sample Attached option:");
    if (newSample && newSample.trim()) {
      const cleanSample = newSample.trim();
      const val = cleanSample.toLowerCase().replace(/\s+/g, '_');
      if (!sampleOptions.some(o => o.value === val)) {
        setSampleOptions(prev => [...prev, { value: val, label: cleanSample }]);
      }
      setFormData(prev => ({ ...prev, sampleAttached: val }));
    }
  };

  const [isRefreshingTaskData, setIsRefreshingTaskData] = useState(false);
  const [bindingMasterCustomData, setBindingMasterCustomData] = useState({
    processRows: [],
    bindingProductRows: [],
    padBindingProductRows: [],
    visualateBindingProductRows: [],
    hardboundGallyBindingProductRows: [],
    slabRows: [],
  });
  const defaultLaminationOptions = ['Matt Lamination B/S', 'Matt Lamination O/S', 'Gloss Lamination B/S', 'Gloss Lamination O/S', 'Velvet Lamination B/S', 'Velvet Lamination O/S', 'Thermal Lamination B/S', 'Thermal Lamination O/S', 'Aqua Varsnish B/S', 'Aqua Varsnish O/S'];
  const laminationOptionValues = Array.from(new Set([...defaultLaminationOptions, ...(laminationTypes || []).map(lam => ((lam === null || lam === void 0 ? void 0 : lam.laminationName) || '').trim()).filter(Boolean)]));
  const bindingProductOptions = Array.from(new Set((bindingMasterCustomData.bindingProductRows || []).map(row => ((row === null || row === void 0 ? void 0 : row.productName) || '').trim()).filter(Boolean)));
  const bindingProductProcessMap = (bindingMasterCustomData.bindingProductRows || []).reduce((acc, row) => {
    const productName = ((row === null || row === void 0 ? void 0 : row.productName) || '').trim();
    if (!productName) return acc;
    acc[productName] = Array.isArray(row.selectedProcesses) ? row.selectedProcesses : [];
    return acc;
  }, {});
  const normalizeText = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const resolveBindingProductFromQuotation = rawBindingType => {
    const source = String(rawBindingType || '').trim();
    if (!source) return '';
    const exact = bindingProductOptions.find(name => name.toLowerCase() === source.toLowerCase());
    if (exact) return exact;
    const normalizedSource = normalizeText(source);
    const partial = bindingProductOptions.find(name => {
      const normalizedName = normalizeText(name);
      return normalizedName.includes(normalizedSource) || normalizedSource.includes(normalizedName);
    });
    return partial || source;
  };
  const selectedOptionIdx = parseInt(formData.selectedOptionIndex, 10);
  const selectedResult = (selectedQuotation === null || selectedQuotation === void 0 ? void 0 : (_selectedQuotation$re = selectedQuotation.results) === null || _selectedQuotation$re === void 0 ? void 0 : _selectedQuotation$re[Number.isNaN(selectedOptionIdx) ? 0 : selectedOptionIdx]) || (selectedQuotation === null || selectedQuotation === void 0 ? void 0 : (_selectedQuotation$re2 = selectedQuotation.results) === null || _selectedQuotation$re2 === void 0 ? void 0 : _selectedQuotation$re2[0]) || null;
  const pickBindingRowAmount = row => {
    var _ref3, _row$finalAmount;
    const v = (_ref3 = (_row$finalAmount = row === null || row === void 0 ? void 0 : row.finalAmount) !== null && _row$finalAmount !== void 0 ? _row$finalAmount : row === null || row === void 0 ? void 0 : row.rawAmount) !== null && _ref3 !== void 0 ? _ref3 : row === null || row === void 0 ? void 0 : row.amount;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const bindingAmountByProcess = (_selectedResult$padBo => {
    const acc = {};
    const apply = rows => {
      (Array.isArray(rows) ? rows : []).forEach(row => {
        const key = String((row === null || row === void 0 ? void 0 : row.processName) || '').trim().toLowerCase();
        if (key) acc[key] = pickBindingRowAmount(row);
      });
    };
    apply(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo = selectedResult.padBookCosts) === null || _selectedResult$padBo === void 0 ? void 0 : _selectedResult$padBo.bindingBreakdown);
    apply(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.bindingBreakdown);
    return acc;
  })();
  const lookupBindingAmount = processName => {
    const key = String(processName || '').trim().toLowerCase();
    if (key && bindingAmountByProcess[key] != null) return bindingAmountByProcess[key];
    const norm = normalizeText(processName);
    if (!norm) return undefined;
    for (const [bdKey, amt] of Object.entries(bindingAmountByProcess)) {
      if (normalizeText(bdKey) === norm) return amt;
    }
    return undefined;
  };
  const bindingProcessNamesOrdered = (() => {
    const productName = String(formData.bindingProduct || '').trim();
    const processesForProduct = productName
      ? (bindingProductProcessMap[productName] || []).map((p) => String(p || '').trim()).filter(Boolean)
      : [];
    const fromForm = (formData.bindingProcesses || []).map((p) => String(p || '').trim()).filter(Boolean);
    const fromBreakdown = [
      ...((selectedResult?.padBookCosts?.bindingBreakdown) || []),
      ...((selectedResult?.bindingBreakdown) || []),
    ]
      .map((row) => String(row?.processName || '').trim())
      .filter(Boolean);
    const seen = new Set();
    const out = [];
    const push = (name) => {
      const k = name.toLowerCase();
      if (!name || seen.has(k)) return;
      seen.add(k);
      out.push(name);
    };
    if (processesForProduct.length > 0) {
      processesForProduct.forEach(push);
    } else if (fromForm.length > 0) {
      fromForm.forEach(push);
    } else {
      fromBreakdown.forEach(push);
    }
    out.sort((a, b) => compareBindingProcessesBySequence(a, b));
    return out;
  })();
  const bindingMasterCalc = useMemo(
    () => computeJobCardBindingTaskAmount(formData, processRows, bindingMasterCustomData),
    [
      formData.bindingProduct,
      formData.pages,
      formData.paperGsm,
      formData.ups,
      formData.size,
      formData.baseQty,
      formData.qtyCutSheet,
      formData.qtyFullSheet,
      formData.coverPaperGsm,
      processRows,
      bindingMasterCustomData,
    ]
  );
  const bindingAmountFromMaster = useMemo(() => {
    const map = {};
    (bindingMasterCalc.breakdown || []).forEach((row) => {
      const name = String(row?.processName || '').trim();
      if (!name) return;
      const amt = Number(row?.amount) || 0;
      map[name.toLowerCase()] = amt;
      map[normalizeText(name)] = amt;
    });
    return map;
  }, [bindingMasterCalc]);
  const bindingProcessRowsWithAmount = bindingProcessNamesOrdered.map((processName) => {
    const key = String(processName || '').trim().toLowerCase();
    const norm = normalizeText(processName);
    const masterAmt = bindingAmountFromMaster[key] ?? bindingAmountFromMaster[norm];
    const quotationAmt = lookupBindingAmount(processName);
    const amount =
      masterAmt != null && masterAmt > 0
        ? formatBindingProcessDisplayAmount(masterAmt)
        : quotationAmt != null && quotationAmt > 0
          ? formatBindingProcessDisplayAmount(quotationAmt)
          : '';
    return { processName, amount };
  });
  const capitalizeFirstLetter = string => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
  };
  const getLaminationDisplayName = laminationValue => {
    if (!laminationValue || laminationValue === 'none') return '';
    const laminationMap = {
      // Inner lamination from Booklet
      'matt-all': 'Matt (All Pages)',
      'gloss-all': 'Gloss (All Pages)',
      'varnish-all': 'Varnish (All Pages)',
      // Cover lamination from Booklet
      'matt': 'Matt',
      'gloss': 'Gloss',
      'thermal': 'Thermal - ₹0.85',
      'velvet': 'Velvet - ₹3',
      'varnish': 'Varnish - ₹0.25'
    };
    return laminationMap[laminationValue] || capitalizeFirstLetter(laminationValue); // Fallback for other types
  };
  const getLaminationNameFromQuotationValue = laminationValue => {
    if (!laminationValue || laminationValue === 'none') {
      return '';
    }

    // Check if laminationValue is a numeric ID
    const laminationId = parseInt(laminationValue, 10);
    if (!isNaN(laminationId) && laminationTypes) {
      const laminationById = laminationTypes.find(lam => String(lam.id) === String(laminationId));
      if (laminationById) {
        return (laminationById.laminationName || '').trim();
      }
    }

    // Fallback to existing string-based mapping for backward compatibility
    const value = String(laminationValue).toLowerCase();
    const laminationMap = {
      'matt-all': 'Matt Lamination B/S',
      'gloss-all': 'Gloss Lamination B/S',
      'varnish-all': 'Aqua Varsnish B/S',
      'matt': 'Matt Lamination B/S',
      'gloss': 'Gloss Lamination B/S',
      'thermal': 'Thermal Lamination B/S',
      'velvet': 'Velvet Lamination B/S',
      'varnish': 'Aqua Varsnish B/S',
      // CutToSheet / legacy lamination codes
      'mattbs': 'Matt Lamination B/S',
      'glossbs': 'Gloss Lamination B/S',
      'varnishbs': 'Aqua Varsnish B/S',
      'thermattbs': 'Thermal Lamination B/S',
      'velmattbs': 'Velvet Lamination B/S',
      'mattos': 'Matt Lamination O/S',
      'glossos': 'Gloss Lamination O/S',
      'varnishos': 'Aqua Varsnish O/S',
      'thermattos': 'Thermal Lamination O/S',
      'velmattos': 'Velvet Lamination O/S'
    };
    const mappedName = laminationMap[value];
    if (mappedName) {
      const exists = laminationTypes === null || laminationTypes === void 0 ? void 0 : laminationTypes.find(lam => (lam.laminationName || '').trim().toLowerCase() === mappedName.toLowerCase());
      if (exists) {
        return (exists.laminationName || mappedName).trim();
      } else {
        const partialMatch = laminationTypes === null || laminationTypes === void 0 ? void 0 : laminationTypes.find(lam => (lam.laminationName || '').toLowerCase().includes(value) || (lam.laminationName || '').toLowerCase().includes(value.replace('-all', '')));
        if (partialMatch) {
          return (partialMatch.laminationName || '').trim();
        }
      }
    }
    const directMatch = laminationTypes === null || laminationTypes === void 0 ? void 0 : laminationTypes.find(lam => (lam.laminationName || '').trim().toLowerCase() === value);
    if (directMatch) {
      return (directMatch.laminationName || '').trim();
    }
    return '';
  };
  const parseCutSize = cutSize => {
    if (!cutSize || typeof cutSize !== 'string') {
      return {
        length: 0,
        width: 0
      };
    }
    const dimensions = cutSize.toLowerCase().split('x');
    if (dimensions.length !== 2) {
      return {
        length: 0,
        width: 0
      };
    }
    const length = parseFloat(dimensions[0]);
    const width = parseFloat(dimensions[1]);
    return {
      length: isNaN(length) ? 0 : length,
      width: isNaN(width) ? 0 : width
    };
  };
  const getCanonicalMachineName = rawName => {
    const t = String(rawName || '').trim().toLowerCase();
    if (!t) return '';
    const hit = (printingMachines || []).find(m => String((m === null || m === void 0 ? void 0 : m.machineName) || '').trim().toLowerCase() === t);
    return (hit === null || hit === void 0 ? void 0 : hit.machineName) || '';
  };
  const getEnabledPrintingMachines = () => {
    return (printingMachines || []).filter(m => {
      var _m$isEnabled, _m$isEnabled2;
      return !(m && m.isEnabled === false) && !(m && m.isEnabled === 0) && String((_m$isEnabled = m === null || m === void 0 ? void 0 : m.isEnabled) !== null && _m$isEnabled !== void 0 ? _m$isEnabled : 'true').trim().toLowerCase() !== 'false' && String((_m$isEnabled2 = m === null || m === void 0 ? void 0 : m.isEnabled) !== null && _m$isEnabled2 !== void 0 ? _m$isEnabled2 : '1').trim() !== '0';
    });
  };
  const getSingleColorMachineName = () => {
    const hit = getEnabledPrintingMachines().find(m => String((m === null || m === void 0 ? void 0 : m.machineName) || '').toLowerCase().includes('heidelberg'));
    return (hit === null || hit === void 0 ? void 0 : hit.machineName) || '';
  };
  const getLegacyMachineForProcess = (printingType, cutSize) => {
    if (!printingType || !cutSize) return '';
    const normalizedCutSize = cutSize.toLowerCase();
    const normalizedPrintingType = printingType.toLowerCase();

    // Rule 1: single color jobs (1+0, 1+1, 2+0, 2+2, single) should use Heidelberg
    if ((normalizedPrintingType.includes('single') || normalizedPrintingType.includes('1+0') || normalizedPrintingType.includes('1+1') || normalizedPrintingType.includes('2+0') || normalizedPrintingType.includes('2+2')) && !normalizedPrintingType.includes('cover')) {
      return 'Heidelberg';
    }

    // Rule 2: if sheet size 20x28, 20x29.5, 20x30 then Komori 529
    if (normalizedCutSize.includes('20x30') || normalizedCutSize.includes('20x28') || normalizedCutSize.includes('20x29.5')) {
      return 'Komori 529';
    }

    // Rule 3: else other size Komori 426
    return 'Komori 426';
  };
  const getMachineForProcess = (printingType, cutSize, preferredMachineName = '') => {
    const canonicalPreferred = getCanonicalMachineName(preferredMachineName);
    if (canonicalPreferred) return canonicalPreferred;
    const enabledMachines = getEnabledPrintingMachines();
    const sheet = parseSizeInches(cutSize);
    const eligible = enabledMachines.filter(m => {
      if (printingType && !machineAppliesToPrintingType(m, printingType)) return false;
      if (sheet && !sheetFitsInMax({
        width: sheet.w,
        height: sheet.h
      }, m.maxPaperSize)) return false;
      return true;
    });
    if (eligible.length > 0) return eligible[0].machineName || '';
    const singleColorMachine = getSingleColorMachineName();
    const normalizedPrintingType = String(printingType || '').toLowerCase();
    const isSingleColor = normalizedPrintingType.includes('single') || normalizedPrintingType.includes('1+0') || normalizedPrintingType.includes('1+1') || normalizedPrintingType.includes('2+0') || normalizedPrintingType.includes('2+2');
    if (isSingleColor && singleColorMachine) return singleColorMachine;
    const legacy = getLegacyMachineForProcess(printingType, cutSize);
    const canonicalLegacy = getCanonicalMachineName(legacy);
    return canonicalLegacy || legacy;
  };
  const getFitSheetSizeForBooklet = (pSize, pType) => {
    const isSingleOr2Plus2 = pType === 'single' || pType === '2+2';
    switch (pSize) {
      case 'A4':
      case 'A5':
      case 'A6':
      case '8x8':
        return '18x25';
      case 'Letter':
      case 'Half-Letter':
      case '11x11':
        return '18x23';
      case '7.1x9.5':
      case '7.1x4.75':
      case '9.5x13.5':
        return isSingleOr2Plus2 ? '15x20' : '20x30';
      case '9x9':
        return '20x28 or 20x30';
      case '12x12':
        return '13x26';
      default:
        return '20x30';
    }
  };
  const fetchNextJobCardNumber = () => {
    makeAuthenticatedRequest('/api/jobcards/next-number').then(res => res.json()).then(data => {
      var _data$data;
      const nextNumber = (data === null || data === void 0 ? void 0 : (_data$data = data.data) === null || _data$data === void 0 ? void 0 : _data$data.jobCardNum) || '';
      if (!nextNumber) return;
      setFormData(prev => ({
        ...prev,
        jobCardNum: prev.jobCardNum || nextNumber
      }));
    }).catch(() => {
      // Keep fallback behavior if API fails
    });
  };
  const handleEdit = async (jobCard) => {
    let cardToEdit = jobCard;
    if (jobCard?.id) {
      try {
        const response = await makeAuthenticatedRequest(`/api/jobcards/${jobCard.id}`);
        const payload = await response.json();
        if (response.ok && payload?.data) {
          cardToEdit = { ...jobCard, ...payload.data };
        }
      } catch (_) {
        /* use list row */
      }
    }
    setEditingJobCard(cardToEdit);
    setShowList(false);
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  };
  const handleAddNewJobCard = () => {
    setEditingJobCard(null);
    setFormData({
      customerName: '',
      quotationNumber: '',
      productName: '',
      jobName: '',
      jobCardNum: '',
      pages: '',
      size: '— Custom —',
      poNumber: '',
      imageAttached: '',
      imageData: '',
      billingType: 'billing',
      sampleAttached: 'no',
      paperLength: '',
      paperWidth: '',
      cutSize: '',
      ups: '',
      qtyFullSheet: '',
      qtyCutSheet: '',
      paperGsm: '',
      paperType: '',
      paperBy: 'us',
      jobColor: '',
      plateBy: 'us',
      jobType: 'new',
      priority: 'regular',
      repeatNo: '',
      requestPlate: 'pc2plate',
      coverPaperLength: '',
      coverPaperWidth: '',
      coverCutSize: '',
      coverUps: '',
      coverQtyFullSheet: '',
      coverQtyCutSheet: '',
      coverPaperGsm: '',
      coverPaperType: '',
      coverPaperBy: 'us',
      coverPrintingColor: '',
      bindingProduct: '',
      bindingProcesses: [],
      internalFabrications: [],
      externalFabrications: [],
      internalFabricationJointProducts: {},
      externalFabricationJointProducts: {},
      posterGumming: false,
      gummingWidth: '',
      gummingHeight: '',
      noOfStrips: '',
      gummingStripType: '',
      dispatchDate: '',
      baseQty: '',
      remark: '',
      varnishTaskMode: '',
      createdBy: ''
    });
    setUploadedImageData('');
    fetchNextJobCardNumber();
    setShowCoverPaper(false);
    setSelectedQuotation(null);
    setProcessRows([{
      forms: '',
      sideCount: '',
      qty: '',
      extraSheets: '',
      plates: '',
      type: '',
      machine: '',
      lamination: ''
    }]);
    setShowList(false);
    manualBookletAppliedKeyRef.current = '';
  };
  useEffect(() => {
    if (!editingJobCard) {
      fetchNextJobCardNumber();
    }
    makeAuthenticatedRequest('/api/bindingmastercustom').then(res => res.json()).then(data => {
      const payload = (data === null || data === void 0 ? void 0 : data.data) || {};
      setBindingMasterCustomData({
        processRows: Array.isArray(payload.processRows) ? payload.processRows : [],
        bindingProductRows: Array.isArray(payload.bindingProductRows) ? payload.bindingProductRows : [],
        padBindingProductRows: Array.isArray(payload.padBindingProductRows) ? payload.padBindingProductRows : [],
        visualateBindingProductRows: Array.isArray(payload.visualateBindingProductRows) ? payload.visualateBindingProductRows : [],
        hardboundGallyBindingProductRows: Array.isArray(payload.hardboundGallyBindingProductRows) ? payload.hardboundGallyBindingProductRows : [],
        slabRows: Array.isArray(payload.slabRows) ? payload.slabRows : [],
      });
    }).catch(() => {
      setBindingMasterCustomData({
        processRows: [],
        bindingProductRows: [],
        padBindingProductRows: [],
        visualateBindingProductRows: [],
        hardboundGallyBindingProductRows: [],
        slabRows: [],
      });
    });

    // Quotation loading is now done via search-as-you-type (no upfront bulk load)

    const bookletProcessData = !editingJobCard ? sessionStorage.getItem('bookletProcessDetails') : null;
    if (bookletProcessData) {
      try {
        const data = JSON.parse(bookletProcessData);
        const firstDetail = data.processDetails && data.processDetails.length > 0 ? data.processDetails[0] : null;
        const quotationDetails = data.quotationDetails || {};
        const inputs = quotationDetails.inputs || {};
        const results = quotationDetails.results || [];
        const firstResult = results.length > 0 ? results[0] : {};
        const resultInputs = firstResult.inputs || inputs;

        // Start building form data
        let newFormData = {
          ...formData,
          customerName: data.customerName || '',
          quotationNumber: data.quotationNumber || '',
          productName: data.productName || 'Booklet',
          quotationDetails: quotationDetails,
          paperGsm: resultInputs.gsm || '',
          paperType: resultInputs.paperType || '',
          jobColor: resultInputs.printing || '',
          bindingProduct: resultInputs.bindingType || inputs.bindingType || '',
          bindingProcesses: []
        };
        if (firstDetail && firstDetail.fitSheetSize) {
          const sheetSize = firstDetail.fitSheetSize;
          const cutSizeData = getCutSizeToSheetMapping(sheetSize);
          const jobUps = firstDetail.ups || (cutSizeData ? cutSizeData.ups : 1);
          const totalSheets = firstDetail.qty || 0;
          const qtyFullSheet = jobUps > 0 ? Math.ceil(totalSheets / jobUps) : totalSheets;
          newFormData = {
            ...newFormData,
            cutSize: sheetSize,
            ups: jobUps,
            qtyCutSheet: totalSheets,
            qtyFullSheet: qtyFullSheet,
            paperLength: (cutSizeData === null || cutSizeData === void 0 ? void 0 : cutSizeData.paperLength) || '',
            paperWidth: (cutSizeData === null || cutSizeData === void 0 ? void 0 : cutSizeData.paperWidth) || ''
          };
        }

        // If booklet cover exists, compute cover paper mapping from Fit Details logic
        if (resultInputs.coverGsm && parseInt(resultInputs.coverGsm) > 0) {
          const paperSize = resultInputs.size || inputs.paperSize;
          const bookletSelected = paperOptions.find(p => p.value === paperSize);
          const bookletUps = (bookletSelected === null || bookletSelected === void 0 ? void 0 : bookletSelected.ups) || 1;
          const qty = parseInt(resultInputs.qty || inputs.qty1 || 0);
          const coverWastage = qty / 2 <= 2100 ? 100 : qty / 2 <= 4000 ? 150 : qty / 2 <= 5000 ? 200 : qty / 2 <= 9000 ? 250 : qty / 2 <= 15000 ? 350 : 500;
          const coverCutSize = getFitSheetSizeForBooklet(paperSize, resultInputs.coverPrintingColor);
          const coverCutMap = getCutSizeToSheetMapping(coverCutSize);
          const coverQtyCutSheet = Math.ceil(qty * 4 / bookletUps + coverWastage);
          const coverUps = (coverCutMap === null || coverCutMap === void 0 ? void 0 : coverCutMap.ups) || 1;
          const coverQtyFullSheet = Math.ceil(coverQtyCutSheet / coverUps);
          newFormData = {
            ...newFormData,
            coverPaperLength: (coverCutMap === null || coverCutMap === void 0 ? void 0 : coverCutMap.paperLength) || '',
            coverPaperWidth: (coverCutMap === null || coverCutMap === void 0 ? void 0 : coverCutMap.paperWidth) || '',
            coverCutSize: coverCutSize || '',
            coverUps: coverUps,
            coverQtyCutSheet: coverQtyCutSheet,
            coverQtyFullSheet: coverQtyFullSheet,
            coverPaperGsm: resultInputs.coverGsm || '',
            coverPaperType: String(resultInputs.coverPaperType || resultInputs.bookletCoverPaperType || '').trim() || '',
            coverPaperBy: 'us',
            coverPrintingColor: resolveCoverPrintingColorFromInputs(resultInputs),
          };
          setShowCoverPaper(true);
        }
        setFormData(newFormData);
        setSelectedQuotation(quotationDetails);
        if (data.processDetails && data.processDetails.length > 0) {
          const innerDetails = data.processDetails.filter(d => d.type !== 'cover');
          const coverDetail = data.processDetails.find(d => d.type === 'cover');
          const allInnerRows = innerDetails.map(detail => {
            const machine = getMachineForProcess(resultInputs.printing, detail.fitSheetSize);
            return {
              forms: detail.forms,
              sideCount: detail.sideCount.toString(),
              qty: detail.qty.toString(),
              sheets: (detail.qty + detail.extraSheets).toString(),
              extraSheets: detail.extraSheets.toString(),
              type: 'inner',
              remark: detail.remark || '',
              machine: machine,
              lamination: getLaminationNameFromQuotationValue(detail.lamination)
            };
          });
          const coverRows = [];
          if (coverDetail) {
            const coverPrintingType = resultInputs.coverPrintingColor;
            const coverMachine = getMachineForProcess(coverPrintingType, coverDetail.fitSheetSize);
            coverRows.push({
              forms: coverDetail.forms,
              sideCount: coverDetail.sideCount.toString(),
              qty: coverDetail.qty.toString(),
              sheets: (coverDetail.qty + coverDetail.extraSheets).toString(),
              extraSheets: coverDetail.extraSheets.toString(),
              type: 'cover',
              remark: coverDetail.remark || '',
              machine: coverMachine,
              lamination: getLaminationNameFromQuotationValue(resultInputs.coverLamination)
            });
          }
          const convertedProcessRows = [...allInnerRows, ...coverRows];
          if (convertedProcessRows.length > 0) {
            setProcessRows(convertedProcessRows);
          }
          setBookletDataLoaded(true);
          setTimeout(() => setBookletDataLoaded(false), 5000);
        }
        sessionStorage.removeItem('bookletProcessDetails');
      } catch (error) {}
    }
    if (editingJobCard) {
      const rawTm = editingJobCard.taskManager;
      let parsedTm = {};
      if (rawTm && typeof rawTm === 'object') {
        parsedTm = rawTm;
      } else if (typeof rawTm === 'string') {
        try {
          parsedTm = JSON.parse(rawTm || '{}');
        } catch (_) {}
      }
      const processDetails = editingJobCard.processDetails || [];
      const updatedProcessDetails = processDetails.map(process => {
        const qty = parseInt(process.qty || 0, 10);
        const extraSheets = parseInt(process.extraSheets || 0, 10);
        return {
          ...process,
          sheets: (qty + extraSheets).toString()
        };
      });
      const cardHasVarnish = updatedProcessDetails.some(row => {
        const lam = String(row.lamination || '').toLowerCase();
        return lam.includes('varnish') || lam.includes('varsnish');
      });
      let savedVarnishTaskMode = parsedTm.varnishTaskMode || '';
      if (!savedVarnishTaskMode && cardHasVarnish) {
        if (parsedTm.externalFabricationVarnish && parsedTm.externalFabricationVarnish.selected) {
          savedVarnishTaskMode = 'external';
        } else if (parsedTm.printing && parsedTm.printing.selected) {
          const inst = String(parsedTm.printing.instructions || '').toLowerCase();
          if (inst.includes('varnish') || inst.includes('varsnish')) {
            savedVarnishTaskMode = 'printing';
          }
        }
      }
      const intFabIds = normalizeFabSelection(editingJobCard.internalFabrications || editingJobCard.internalFabrication, internalFabrications);
      const extFabIds = normalizeFabSelection(editingJobCard.externalFabrications || editingJobCard.externalFabrication, externalFabrications);
      const intJRaw = editingJobCard.internalFabricationJointProducts || {};
      let extJ = {
        ...(editingJobCard.externalFabricationJointProducts || {})
      };
      const intPieces = Object.keys(intJRaw).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map(k => intJRaw[k]).filter(v => v != null && String(v).trim() !== '');
      if (intPieces.length) {
        const mergedStr = intPieces.map(v => String(v).trim()).join(', ');
        const exist = extJ['0'];
        extJ['0'] = exist ? `${exist}, ${mergedStr}` : mergedStr;
      }
      extJ = resolveJointProductsMap(extJ, extFabIds, externalFabrications);
      const intJ = resolveJointProductsMap({
        ...intJRaw
      }, intFabIds, internalFabrications);
      const soi = editingJobCard.selectedOptionIndex;
      const optionIndexStr = soi === '' || soi === null || soi === undefined ? '' : String(soi);
      const loadedPriority = String(editingJobCard.priority || '').toLowerCase().trim();
      const normalizedPriority = loadedPriority === 'urgent' || loadedPriority === 'most_urgent'
        ? 'most_urgent'
        : 'regular';
      setFormData({
        ...editingJobCard,
        priority: normalizedPriority,
        coverPrintingColor: resolveCoverPrintingColorForJobCardForm(editingJobCard),
        jobType: editingJobCard.jobType === 'old' ? 'repeat' : editingJobCard.jobType || 'new',
        dispatchDate: editingJobCard.dispatchDate || '',
        baseQty: editingJobCard.baseQty || '',
        remark: editingJobCard.remark || '',
        createdBy: editingJobCard.createdBy || '',
        bindingProduct: editingJobCard.bindingProduct || '',
        bindingProcesses: Array.isArray(editingJobCard.bindingProcesses) ? editingJobCard.bindingProcesses : [],
        internalFabrications: intFabIds,
        externalFabrications: extFabIds,
        internalFabricationJointProducts: intJ,
        externalFabricationJointProducts: extJ,
        selectedOptionIndex: optionIndexStr,
        varnishTaskMode: savedVarnishTaskMode
      });
      setUploadedImageData(editingJobCard.imageData || '');
      setTaskManager(ensureExternalFabJointTasksInTaskManager(backfillFabTaskCategoriesOnTaskManager(hydrateTaskManagerFromJobCard(editingJobCard.taskManager), internalFabrications, externalFabrications, editingJobCard), {
        externalFabrications: extFabIds,
        externalFabricationJointProducts: extJ
      }, internalFabrications, externalFabrications));
      if (parsedTm && Array.isArray(parsedTm.customOrder) && parsedTm.customOrder.length > 0) {
        setTaskOrder(parsedTm.customOrder);
      } else {
        setTaskOrder([]);
      }
      if (editingJobCard.quotationDetails && typeof editingJobCard.quotationDetails === 'object') {
        setSelectedQuotation(editingJobCard.quotationDetails);
        const results = Array.isArray(editingJobCard.quotationDetails.results) ? editingJobCard.quotationDetails.results : [];
        setQuotationOptions(results.map((option, idx) => ({
          ...option,
          __originalIndex: idx
        })));
      } else {
        setSelectedQuotation(null);
        setQuotationOptions([]);
      }
      setShowCoverPaper(!!(editingJobCard.coverPaperGsm && String(editingJobCard.coverPaperGsm).trim() !== '' || editingJobCard.coverCutSize && String(editingJobCard.coverCutSize).trim() !== '' || editingJobCard.coverQtyFullSheet && parseFloat(editingJobCard.coverQtyFullSheet) > 0 || editingJobCard.coverQtyCutSheet && parseFloat(editingJobCard.coverQtyCutSheet) > 0));
      setProcessRows(updatedProcessDetails);
    }
  }, [editingJobCard]);
  useEffect(() => {
    if (editingJobCard) return;
    const source = selectedQuotation ? 'quotationAmount' : 'amount';
    setMasterAmountSource(source);
    setTaskManager(prev => {
      const next = {
        ...prev
      };
      Object.keys(next).forEach(k => {
        if (next[k]) next[k].amountSource = source;
      });
      return next;
    });
  }, [selectedQuotation, editingJobCard]);

  // Close quotation search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = e => {
      if (quotationSearchRef.current && !quotationSearchRef.current.contains(e.target)) {
        setQuotationSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    if (
      isJobCardUsingQuotation(selectedQuotation, formData.quotationNumber)
      || bookletDataLoaded
      || editingJobCard
    ) {
      return;
    }
    const firstRow = processRows[0];
      const isFirstRowEmpty = firstRow && !firstRow.forms && !firstRow.qty && !firstRow.extraSheets && !firstRow.type;
      if (processRows.length === 1 && isFirstRowEmpty) {
        const {
          qtyCutSheet,
          jobColor
        } = formData;
        if (qtyCutSheet > 0) {
          const newFirstRow = {
            ...firstRow
          };
          newFirstRow.qty = qtyCutSheet.toString();
          const qty = parseInt(qtyCutSheet) || 0;
          const wastage = qty <= 1000 ? 50 : qty <= 5000 ? 100 : 200;
          newFirstRow.extraSheets = wastage.toString();
          if (jobColor) {
            if (jobColor.includes('bothsides') || jobColor.includes('4+4') || jobColor.includes('2+2') || jobColor.includes('1+1')) {
              newFirstRow.forms = 'frontback';
              newFirstRow.sideCount = '2';
            } else if (jobColor.includes('oneside') || jobColor.includes('4+0') || jobColor.includes('2+0') || jobColor.includes('1+0')) {
              newFirstRow.forms = 'oneside';
              newFirstRow.sideCount = '1';
            }
          }
          newFirstRow.type = 'inner';
          const updatedQty = parseInt(newFirstRow.qty || 0);
          const updatedExtraSheets = parseInt(newFirstRow.extraSheets || 0);
          newFirstRow.sheets = (updatedQty + updatedExtraSheets).toString();
          setProcessRows([newFirstRow]);
        }
      }
  }, [formData.qtyCutSheet, formData.jobColor, selectedQuotation, formData.quotationNumber, bookletDataLoaded, editingJobCard]);

  const manualBookletAutoFill = useMemo(() => {
    if (
      isJobCardUsingQuotation(selectedQuotation, formData.quotationNumber)
      || editingJobCard
      || bookletDataLoaded
    ) {
      return null;
    }
    return computeManualJobCardBookletAutoFill({
      pagesInput: formData.pages,
      sizeStr: formData.size,
      baseQty: formData.baseQty,
      paperType: formData.paperType,
      paperTypes,
      printingType: formData.jobColor,
      coverPrintingType: formData.coverPrintingColor,
      getCutSizeToSheetMapping,
      getFitSheetSizeForBooklet,
      getMachineForProcess,
    });
  }, [
    selectedQuotation,
    formData.quotationNumber,
    editingJobCard,
    bookletDataLoaded,
    formData.pages,
    formData.size,
    formData.baseQty,
    formData.paperType,
    formData.jobColor,
    formData.coverPrintingColor,
    paperTypes,
  ]);

  useEffect(() => {
    if (isJobCardUsingQuotation(selectedQuotation, formData.quotationNumber)) {
      manualBookletAppliedKeyRef.current = '';
      return;
    }
    if (!manualBookletAutoFill?.ok) {
      manualBookletAppliedKeyRef.current = '';
      return;
    }
    const applyKey = [
      formData.pages,
      formData.size,
      formData.baseQty,
      formData.paperType,
      formData.jobColor,
      formData.coverPrintingColor,
    ].join('|');
    if (manualBookletAppliedKeyRef.current === applyKey) return;
    manualBookletAppliedKeyRef.current = applyKey;

    const { processRows: nextRows, formPatch, showCoverPaper: showCover } = manualBookletAutoFill;
    setProcessRows(nextRows);
    setFormData((prev) => {
      const merged = { ...prev, ...formPatch };
      setTimeout(() => autoSelectTasks(merged, nextRows), 0);
      return merged;
    });
    if (showCover) setShowCoverPaper(true);
  }, [
    manualBookletAutoFill,
    selectedQuotation,
    formData.quotationNumber,
    formData.pages,
    formData.size,
    formData.baseQty,
    formData.paperType,
    formData.jobColor,
    formData.coverPrintingColor,
  ]);

  const handleInputChange = e => {
    const {
      name,
      value
    } = e.target;
    const newFormData = {
      ...formData,
      [name]: value
    };
    if (name === 'bindingProduct') {
      const mappedProcesses = bindingProductProcessMap[value] || (value ? [value] : []);
      newFormData.bindingProcesses = [...mappedProcesses];
      setTimeout(() => autoSelectTasks(newFormData), 0);
    }
    if (name === 'cutSize' && value) {
      const cutSizeData = getCutSizeToSheetMapping(value);
      if (cutSizeData) {
        newFormData.paperLength = cutSizeData.paperLength;
        newFormData.paperWidth = cutSizeData.paperWidth;
        newFormData.ups = cutSizeData.ups;
      }
    }
    if (name === 'coverCutSize' && value) {
      const cutSizeData = getCutSizeToSheetMapping(value);
      if (cutSizeData) {
        newFormData.coverPaperLength = cutSizeData.paperLength;
        newFormData.coverPaperWidth = cutSizeData.paperWidth;
        newFormData.coverUps = cutSizeData.ups;
        const coverQtyFullSheetFromState = parseInt(newFormData.coverQtyFullSheet) || 0;
        if (coverQtyFullSheetFromState > 0) {
          newFormData.coverQtyCutSheet = (parseInt(newFormData.coverUps) || 0) * coverQtyFullSheetFromState;
        }
      }
    }

    // Auto-calc Cover Qty Cut Sheet when coverUps or coverQtyFullSheet changes
    if (name === 'coverUps' || name === 'coverQtyFullSheet') {
      const coverUps = name === 'coverUps' ? parseInt(value) || 0 : parseInt(newFormData.coverUps) || 0;
      const coverQtyFullSheet = name === 'coverQtyFullSheet' ? parseInt(value) || 0 : parseInt(formData.coverQtyFullSheet) || 0;
      newFormData.coverQtyCutSheet = coverUps * coverQtyFullSheet;
    }
    if (name === 'ups' || name === 'qtyFullSheet') {
      const ups = name === 'ups' ? parseInt(value) || 0 : parseInt(newFormData.ups) || 0;
      const qtyFullSheet = name === 'qtyFullSheet' ? parseInt(value) || 0 : parseInt(formData.qtyFullSheet) || 0;
      newFormData.qtyCutSheet = ups * qtyFullSheet;
    }
    if (name === 'jobType' || name === 'plateBy') {
      const jobTypeVal = name === 'jobType' ? value : newFormData.jobType;
      const plateByVal = name === 'plateBy' ? value : newFormData.plateBy;
      newFormData.requestPlate = resolveAutoRequestPlate(jobTypeVal, plateByVal);
    }
    setFormData(newFormData);

    // Auto-recalculate tasks when fields affecting cutting or other tasks change
    const fieldsAffectingTasks = [
      'paperBy', 'coverPaperBy', 'paperLength', 'paperWidth', 'paperGsm', 'qtyFullSheet', 'paperType',
      'coverPaperLength', 'coverPaperWidth', 'coverPaperGsm', 'coverQtyFullSheet', 'coverPaperType',
      'bindingProduct', 'pages', 'ups', 'qtyCutSheet', 'baseQty', 'qtyFullSheet', 'size',
    ];
    if (fieldsAffectingTasks.includes(name)) {
      setTimeout(() => autoSelectTasks(newFormData), 0);
    }
  };

  const handleDispatchDateChange = (e) => {
    setDispatchDateDisplay(maskDispatchDateInput(e.target.value));
  };

  const handleDispatchDateBlur = () => {
    const trimmed = String(dispatchDateDisplay || '').trim();
    if (!trimmed) {
      setFormData((prev) => ({ ...prev, dispatchDate: '' }));
      setDispatchDateDisplay('');
      return;
    }
    const iso = parseDispatchDateInputToIso(trimmed);
    if (!iso) {
      alert('Enter dispatch date as DD/MM/YYYY (e.g. 25/05/2026).');
      setDispatchDateDisplay(formatDispatchDateForInput(formData.dispatchDate));
      return;
    }
    setFormData((prev) => ({ ...prev, dispatchDate: iso }));
    setDispatchDateDisplay(formatDispatchDateForInput(iso));
  };

  const jobSizeDimensions = useMemo(
    () => parseJobCardSizeToDimensions(formData.size),
    [formData.size]
  );
  const innerPaperFullSizeStarted = useMemo(
    () => isPaperFullSizeStarted(formData.paperLength, formData.paperWidth),
    [formData.paperLength, formData.paperWidth]
  );
  const coverPaperFullSizeStarted = useMemo(
    () => isPaperFullSizeStarted(formData.coverPaperLength, formData.coverPaperWidth),
    [formData.coverPaperLength, formData.coverPaperWidth]
  );
  const handleSizeDimensionChange = (dimension, value) => {
    const { w, h } = parseJobCardSizeToDimensions(formData.size);
    const nextW = dimension === 'width' ? value : w;
    const nextH = dimension === 'height' ? value : h;
    setFormData(prev => {
      const next = {
        ...prev,
        size: formatJobCardSizeFromDimensions(nextW, nextH),
      };
      setTimeout(() => autoSelectTasks(next), 0);
      return next;
    });
  };
  const addProcessRow = () => {
    const newRows = [...processRows, {
      remark: '',
      forms: '',
      sideCount: '',
      qty: '',
      extraSheets: '',
      plates: '',
      type: '',
      machine: '',
      lamination: ''
    }];
    setProcessRows(newRows);
    setTimeout(() => autoSelectTasks(formData, newRows), 0);
  };

  // Add process row shortcut using F3 key
  const addRowRef = useRef(null);
  useEffect(() => {
    addRowRef.current = addProcessRow;
  }, [addProcessRow]);
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'F3') {
        var _addRowRef$current;
        e.preventDefault();
        (_addRowRef$current = addRowRef.current) === null || _addRowRef$current === void 0 ? void 0 : _addRowRef$current.call(addRowRef);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const updateProcessRow = (index, field, value) => {
    const updatedRows = [...processRows];
    updatedRows[index][field] = value;
    if (field === 'qty' || field === 'extraSheets') {
      const qty = parseInt(updatedRows[index].qty || 0);
      const extraSheets = parseInt(updatedRows[index].extraSheets || 0);
      updatedRows[index].sheets = (qty + extraSheets).toString();
    }

    // Auto-correct machine selection for single color jobs
    if (field === 'machine') {
      var _formData$jobColor;
      const jobColor = ((_formData$jobColor = formData.jobColor) === null || _formData$jobColor === void 0 ? void 0 : _formData$jobColor.toLowerCase()) || '';
      const selectedMachine = String(value || '').toLowerCase();
      const isHeidelberg = selectedMachine.includes('heidelberg');
      const singleColorMachine = getSingleColorMachineName();
      if (jobColor.includes('single') || jobColor.includes('1+0') || jobColor.includes('1+1') || jobColor.includes('2+0') || jobColor.includes('2+2')) {
        if (!isHeidelberg && singleColorMachine) {
          updatedRows[index].machine = singleColorMachine;
        }
        alert('Single color jobs (1+0, 1+1, 2+0, 2+2) must use Heidelberg machine');
      }
    }
    setProcessRows(updatedRows);
    setTimeout(() => autoSelectTasks(formData, updatedRows), 0);
  };

  // Task Manager Functions
  const taskManagerLockState = useMemo(
    () => getTaskManagerEditLockState(editingJobCard, taskManager),
    [editingJobCard, taskManager]
  );
  const isTaskRowLocked = useCallback(
    (taskName) =>
      isTaskKeyLockedForEditing(
        taskName,
        taskManager?.[taskName],
        editingJobCard,
        taskManagerLockState
      ),
    [taskManager, editingJobCard, taskManagerLockState]
  );
  const updateTaskManager = (taskName, field, value) => {
    if (isTaskRowLocked(taskName)) {
      return;
    }
    setTaskManager(prev => ({
      ...prev,
      [taskName]: {
        ...prev[taskName],
        [field]: value
      }
    }));
  };
  const toggleTaskSelection = taskName => {
    if (isTaskRowLocked(taskName)) {
      alert(
        `This task is locked because production has already reached ${taskManagerLockState.currentStageLabel}.\n`
        + `You can only add, remove or edit tasks that come AFTER ${taskManagerLockState.currentStageLabel}.`
      );
      return;
    }
    setTaskManager(prev => {
      return {
        ...prev,
        [taskName]: {
          ...prev[taskName],
          selected: !prev[taskName].selected
        }
      };
    });
  };
  const isJobCardFormSnapshot = snapshot => {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (typeof snapshot.preventDefault === 'function' || snapshot.nativeEvent != null) return false;
    return 'paperBy' in snapshot || 'jobType' in snapshot || 'customerName' in snapshot || 'internalFabrications' in snapshot;
  };
  const autoSelectTasks = (formSnapshot, processRowsSnapshot, options = {}) => {
    var _selectedQuotation$re3;
    const pr = processRowsSnapshot || processRows;
    const fd = isJobCardFormSnapshot(formSnapshot) ? formSnapshot : formData;
    const preserveSelections = options.preserveSelections === true;
    const selectedInternalFabs = normalizeFabSelection(fd.internalFabrications);
    const selectedExternalFabs = normalizeFabSelection(fd.externalFabrications);
    const src = selectedQuotation ? 'quotationAmount' : 'amount';
    const newTaskManager = {
      cutting: {
        selected: false,
        machine: '',
        amount: '',
        quotationAmount: '',
        amountSource: src,
        instructions: '',
        user: '',
        wastageAmount: ''
      },
      printing: {
        selected: false,
        machine: '',
        amount: '',
        quotationAmount: '',
        amountSource: src,
        instructions: '',
        user: '',
        wastageAmount: ''
      },
      lamination: {
        selected: false,
        machine: '',
        amount: '',
        quotationAmount: '',
        amountSource: src,
        instructions: '',
        user: '',
        wastageAmount: ''
      },
      binding: {
        selected: false,
        machine: '',
        amount: '',
        quotationAmount: '',
        amountSource: src,
        instructions: '',
        user: '',
        wastageAmount: ''
      }
    };
    selectedInternalFabs.forEach((_, idx) => {
      const fabId = selectedInternalFabs[idx];
      const fab = (internalFabrications || []).find(f => String(f.id) === String(fabId));
      newTaskManager[`internalFabrication${idx + 1}`] = {
        selected: true,
        machine: '',
        amount: '',
        quotationAmount: '',
        amountSource: src,
        instructions: '',
        user: '',
        wastageAmount: '',
        fabricationName: getFabLabel(fab) || `Internal Fabrication ${idx + 1}`,
        fabricationId: fabId || '',
        fabTaskCategory: resolveJobCardFabTaskCategory({
          fabricationName: getFabLabel(fab),
          fabricationId: fabId
        }, internalFabrications, externalFabrications, `internalFabrication${idx + 1}`, fd)
      };
    });
    selectedExternalFabs.forEach((_, idx) => {
      const fabId = selectedExternalFabs[idx];
      const fab = (externalFabrications || []).find(f => String(f.id) === String(fabId));
      newTaskManager[`externalFabrication${idx + 1}`] = {
        selected: true,
        machine: '',
        amount: '',
        quotationAmount: '',
        amountSource: src,
        instructions: '',
        user: '',
        wastageAmount: '',
        fabricationName: getFabLabel(fab) || `External Fabrication ${idx + 1}`,
        fabricationId: fabId || '',
        fabTaskCategory: resolveJobCardFabTaskCategory({
          fabricationName: getFabLabel(fab),
          fabricationId: fabId
        }, internalFabrications, externalFabrications, `externalFabrication${idx + 1}`, fd)
      };
    });

    // Add billing last
    newTaskManager.billing = {
      selected: true,
      machine: 'INTERNAL',
      amount: '',
      quotationAmount: '',
      amountSource: src,
      instructions: '',
      user: '',
      wastageAmount: ''
    };
    const innerPaperBy = String(fd.paperBy || 'us').toLowerCase();
    const coverPaperBy = String(fd.coverPaperBy || 'us').toLowerCase();
    const hasCoverPaperFields = !!(fd.coverPaperGsm && String(fd.coverPaperGsm).trim() !== '' || fd.coverQtyFullSheet && parseFloat(fd.coverQtyFullSheet) > 0 || fd.coverPaperLength && fd.coverPaperWidth && parseFloat(fd.coverPaperLength) > 0 && parseFloat(fd.coverPaperWidth) > 0);
    // PAPER task only when we supply at least one paper: inner US or (cover job and cover US)
    const shouldAutoSelectCutting = innerPaperBy === 'us' || hasCoverPaperFields && coverPaperBy === 'us';
    if (shouldAutoSelectCutting) {
      newTaskManager.cutting.selected = true;
      newTaskManager.cutting.machine = 'MACHINE 1';
    } else {
      newTaskManager.cutting.selected = false;
      newTaskManager.cutting.machine = '';
    }

    // Calculate cutting amount using formula: Paper Full Size (L* W) * Gsm/3100*paper rate per kg /500* Sheet Qty (Full Sheet) + Same calculation in Cover paper Amt
    let cuttingAmount = 0;
    let quotationAmount = 0;

    // Check if this is a quotation based job card and extract total paper amount
    if (selectedQuotation) {
      if (selectedQuotation.productType === 'Booklet' && selectedQuotation.results && selectedQuotation.results.length > 0) {
        var _selectedResult$baseC;
        const selectedResult = selectedQuotation.results[fd.selectedOptionIndex || 0] || selectedQuotation.results[0];
        quotationAmount = ((_selectedResult$baseC = selectedResult.baseCost) === null || _selectedResult$baseC === void 0 ? void 0 : _selectedResult$baseC.totalPaperCost) || selectedResult.totalPaperCost || 0;
      } else if (selectedQuotation.results && selectedQuotation.results.length > 0) {
        var _selectedResult$baseC2;
        const selectedResult = selectedQuotation.results[0];
        quotationAmount = ((_selectedResult$baseC2 = selectedResult.baseCost) === null || _selectedResult$baseC2 === void 0 ? void 0 : _selectedResult$baseC2.totalPaperCost) || selectedResult.totalPaperCost || 0;
      }
    }

    // Main paper calculation (only when inner paper supplied by us)
    if (innerPaperBy === 'us' && fd.paperLength && fd.paperWidth && fd.paperGsm && fd.qtyFullSheet) {
      const paperRecord = (paperTypes || []).find(p => String(p.paperTypeName).toLowerCase() === String(fd.paperType).toLowerCase());
      const paperRate = paperRecord ? parseFloat(paperRecord.ratePerKg) || 0 : 0;
      const paperLength = parseFloat(fd.paperLength) || 0;
      const paperWidth = parseFloat(fd.paperWidth) || 0;
      const gsm = parseFloat(fd.paperGsm) || 0;
      const sheetQty = parseFloat(fd.qtyFullSheet) || 0;

      // Formula: (L * W * GSM / 3100 * paper rate per kg / 500) * Sheet Qty
      const mainPaperCost = paperLength * paperWidth * gsm / 3100 * paperRate / 500 * sheetQty;
      cuttingAmount += mainPaperCost;
    }

    // Cover paper calculation (only when cover exists and cover paper supplied by us)
    if (hasCoverPaperFields && coverPaperBy === 'us' && fd.coverPaperLength && fd.coverPaperWidth && fd.coverPaperGsm && fd.coverQtyFullSheet) {
      const coverPaperRecord = (paperTypes || []).find(p => String(p.paperTypeName).toLowerCase() === String(fd.coverPaperType).toLowerCase());
      const coverRate = coverPaperRecord ? parseFloat(coverPaperRecord.ratePerKg) || 0 : 0;
      const coverLength = parseFloat(fd.coverPaperLength) || 0;
      const coverWidth = parseFloat(fd.coverPaperWidth) || 0;
      const coverGsm = parseFloat(fd.coverPaperGsm) || 0;
      const coverQty = parseFloat(fd.coverQtyFullSheet) || 0;

      // Same formula for cover paper
      const coverPaperCost = coverLength * coverWidth * coverGsm / 3100 * coverRate / 500 * coverQty;
      cuttingAmount += coverPaperCost;
    }
    newTaskManager.cutting.amount = cuttingAmount.toFixed(2);
    newTaskManager.cutting.quotationAmount = quotationAmount.toFixed(2);
    newTaskManager.billing.selected = true;
    newTaskManager.billing.machine = 'INTERNAL';

    // Auto-select printing based on machine selection in process rows
    let totalLaminationAmount = 0;
    let totalPrintingAmount = 0;
    const printingMachineNames = new Set();
    pr.forEach(row => {
      if (row.machine) {
        var _ref5, _row$impressionCost, _row$baseCost;
        const qty = parseInt(row.qty) || 0;
        const formCount = parseInt(row.sideCount) || 1;
        let printingAmount = 0;

        // Strict mode: use rates provided in row/master mapping only.
        let impressionCost = Number((_ref5 = (_row$impressionCost = row.impressionCost) !== null && _row$impressionCost !== void 0 ? _row$impressionCost : row.impCost) !== null && _ref5 !== void 0 ? _ref5 : 0);
        let baseCost = Number((_row$baseCost = row.baseCost) !== null && _row$baseCost !== void 0 ? _row$baseCost : 0);

        // Fetch from printing machines master if not already populated
        if (impressionCost === 0 && baseCost === 0 && row.machine) {
          const m = (printingMachines || []).find(m => String(m.machineName).toLowerCase() === String(row.machine).toLowerCase());
          if (m) {
            impressionCost = Number(m.impressionCostDefault || 0);
            baseCost = Number(m.baseCostDefault || 0);
          }
        }

        // Calculate printing amount based on forms type
        if (row.forms) {
          const rounds = Math.ceil(qty / 1000);
          const rounds2 = Math.ceil(qty * 2 / 1000);
          switch (row.forms.toLowerCase()) {
            case 'frontback':
              printingAmount = (rounds * impressionCost - impressionCost + baseCost) * 2 * formCount;
              break;
            case 'selfback':
            case 'double_gripper':
            case 'doublegripper':
              printingAmount = (rounds2 * impressionCost - impressionCost + baseCost) * formCount;
              break;
            case 'oneside':
              printingAmount = (rounds * impressionCost - impressionCost + baseCost) * formCount;
              break;
            default:
              printingAmount = qty;
              break;
          }
        } else {
          printingAmount = qty;
        }

        // Accumulate amounts for each machine type
        totalPrintingAmount += printingAmount;
        if (row.machine) printingMachineNames.add(String(row.machine).toUpperCase());
      }

      // Add varnish cost if varnish task mode is printing
      const isVarnish = lam => {
        const l = String(lam || '').toLowerCase();
        return l.includes('varnish') || l.includes('varsnish');
      };
      if (row.lamination && isVarnish(row.lamination) && String(fd.varnishTaskMode || '').toLowerCase() === 'printing') {
        let varnishAmount = 0;
        const laminationType = (laminationTypes || []).find(lam => lam.laminationName === row.lamination);
        const laminationRate = laminationType ? parseFloat(laminationType.rate) : 0;
        if (laminationRate > 0) {
          const qty = parseInt(row.qty) || 0;
          const extraSheets = parseInt(row.extraSheets) || 0;
          let cutSizeArea = 0;
          if (isProcessRowCover(row.type)) {
            const {
              length,
              width
            } = parseCutSize(fd.coverCutSize);
            cutSizeArea = length * width;
          } else {
            const {
              length,
              width
            } = parseCutSize(fd.cutSize);
            cutSizeArea = length * width;
          }
          const formCount = parseInt(row.sideCount) || 1;
          varnishAmount = cutSizeArea * (qty + extraSheets) * laminationRate / 100 * formCount;
        }
        totalPrintingAmount += varnishAmount;
      }
    });

    // Varnish route: user chooses whether varnish should go to Printing or External.
    if (hasVarnishInProcessRows) {
      const varnishMode = String(fd.varnishTaskMode || '').toLowerCase();
      if (varnishMode === 'printing') {
        newTaskManager.printing.selected = true;
        newTaskManager.printing.instructions = '';
      } else if (varnishMode === 'external') {
        newTaskManager.externalFabricationVarnish = {
          selected: true,
          machine: 'EXTERNAL',
          amount: '',
          quotationAmount: '',
          amountSource: src,
          instructions: '',
          user: '',
          wastageAmount: '',
          fabricationName: varnishInstructionLabel
        };
      }
    }

    // Set printing task selection from process details (not only calculated amount).
    // Amount can be 0 when row-level costing is unavailable, but task must still be selected.
    const hasPrintingProcess = pr.some(row => {
      const qty = parseFloat(row === null || row === void 0 ? void 0 : row.qty) || 0;
      const machine = String((row === null || row === void 0 ? void 0 : row.machine) || '').trim();
      return machine !== '' && qty > 0;
    });
    if (hasPrintingProcess) {
      newTaskManager.printing.selected = true;
      newTaskManager.printing.machine = Array.from(printingMachineNames).join(', ');

      // Override printing machine if varnish is assigned to printing
      if (hasVarnishInProcessRows && String(fd.varnishTaskMode || '').toLowerCase() === 'printing') {
        newTaskManager.printing.machine = 'KOMORI 529';
      }
      newTaskManager.printing.amount = totalPrintingAmount > 0 ? totalPrintingAmount.toFixed(2) : '0';
    } else if (hasVarnishInProcessRows && String(fd.varnishTaskMode || '').toLowerCase() === 'printing') {
      newTaskManager.printing.machine = 'KOMORI 529';
      newTaskManager.printing.amount = totalPrintingAmount > 0 ? totalPrintingAmount.toFixed(2) : '0';
    }
    pr.forEach(row => {
      // Auto-select lamination if specified and it's not varnish (varnish goes to printing/external)
      const isVarnish = lam => {
        const l = String(lam || '').toLowerCase();
        return l.includes('varnish') || l.includes('varsnish');
      };
      if (row.lamination && row.lamination.trim() !== '' && !isVarnish(row.lamination)) {
        newTaskManager.lamination.selected = true;
        newTaskManager.lamination.machine = 'MACHINE 1';
        let laminationAmount = 0;
        const laminationType = laminationTypes.find(lam => lam.laminationName === row.lamination);
        const laminationRate = laminationType ? parseFloat(laminationType.rate) : 0;
        if (laminationRate > 0) {
          const qty = parseInt(row.qty) || 0;
          const extraSheets = parseInt(row.extraSheets) || 0;
          let cutSizeArea = 0;
          if (isProcessRowCover(row.type)) {
            const {
              length,
              width
            } = parseCutSize(fd.coverCutSize);
            cutSizeArea = length * width;
          } else {
            const {
              length,
              width
            } = parseCutSize(fd.cutSize);
            cutSizeArea = length * width;
          }
          const formCount = parseInt(row.sideCount) || 1;
          laminationAmount = cutSizeArea * (qty + extraSheets) * laminationRate / 100 * formCount;
        }
        totalLaminationAmount += laminationAmount;
      }
    });

    // Auto-select binding from dedicated binding section (Binding Master slabs)
    if (fd.bindingProduct && String(fd.bindingProduct).trim() !== '') {
      newTaskManager.binding.selected = true;
      newTaskManager.binding.machine = 'INTERNAL';
      const bindCalc = computeJobCardBindingTaskAmount(fd, pr, bindingMasterCustomData);
      if (bindCalc.amount) {
        newTaskManager.binding.amount = bindCalc.amount;
      }
    }

    // Auto-select fabrication tasks from dedicated fabrication section
    const { bindingQty } = getJobCardBindingCalcInputs(fd, pr);
    const totalSheets = parseFloat(fd?.qtyCutSheet) || parseFloat(fd?.qtyFullSheet) || bindingQty;
    const cutSizeObj = parseCutSize(fd.cutSize) || {};
    const areaWidth = cutSizeObj.length || 0;
    const areaHeight = cutSizeObj.width || 0;
    const totalForms = pr.reduce((sum, row) => sum + (parseFloat(row.sideCount) || 0), 0);
    const leaves = totalForms || 1;

    selectedInternalFabs.forEach((fabId, idx) => {
      const taskKey = `internalFabrication${idx + 1}`;
      const fab = (internalFabrications || []).find(f => String(f.id) === String(fabId));
      if (newTaskManager[taskKey]) {
        newTaskManager[taskKey].selected = true;
        newTaskManager[taskKey].machine = 'INTERNAL';
        const mergedFab = resolveFabricationPricingRow(fab, internalFabrications);
        const baseAmt = calcInternalFabricationAmountWithArea(
          mergedFab,
          bindingQty,
          totalSheets,
          areaWidth,
          areaHeight,
          leaves
        );
        newTaskManager[taskKey].amount = baseAmt ? baseAmt.toFixed(2) : '';
      }
    });
    selectedExternalFabs.forEach((fabId, idx) => {
      const taskKey = `externalFabrication${idx + 1}`;
      const fab = (externalFabrications || []).find(f => String(f.id) === String(fabId));
      if (newTaskManager[taskKey]) {
        var _fd$externalFabricati;
        newTaskManager[taskKey].selected = true;
        newTaskManager[taskKey].machine = 'EXTERNAL';
        const mergedFab = resolveFabricationPricingRow(fab, externalFabrications);
        const baseAmt = calcExternalFabricationAmount(
          mergedFab,
          bindingQty,
          totalSheets,
          areaWidth,
          areaHeight,
          leaves
        );
        newTaskManager[taskKey].amount = baseAmt ? baseAmt.toFixed(2) : '';
        const jointNames = parseJointProductNames((_fd$externalFabricati = fd.externalFabricationJointProducts) === null || _fd$externalFabricati === void 0 ? void 0 : _fd$externalFabricati[idx]);
        jointNames.forEach((jointName, jIdx) => {
          const jointAmt = getJointProductRateFromFab(fab, jointName);
          const jKey = externalFabJointTaskKey(idx, jIdx);
          newTaskManager[jKey] = {
            selected: true,
            machine: 'EXTERNAL',
            amount: jointAmt ? jointAmt.toFixed(2) : '',
            quotationAmount: '',
            amountSource: src,
            instructions: '',
            user: '',
            wastageAmount: '',
            fabricationName: jointName,
            fabricationId: fabId || '',
            parentExternalFabIndex: idx,
            fabTaskCategory: resolveCostBreakdownFabCategory({
              product: jointName
            }, internalFabrications, externalFabrications)
          };
        });
      }
    });

    // Calculate varnish quotation cost adjustment if routed to printing
    let qVarnishAdd = 0;
    let qLamSub = 0;
    if (selectedQuotation && selectedQuotation.results && selectedQuotation.results.length > 0) {
      var _selectedResult$postP, _selectedResult$padBo3;
      const selectedResult = selectedQuotation.results[fd.selectedOptionIndex || 0] || selectedQuotation.results[0];
      const innerLamCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$postP = selectedResult.postPressCosts) === null || _selectedResult$postP === void 0 ? void 0 : _selectedResult$postP.lamCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.lamCost) || 0;
      const coverLamCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo3 = selectedResult.padBookCosts) === null || _selectedResult$padBo3 === void 0 ? void 0 : _selectedResult$padBo3.coverLamCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.coverLaminationCost) || 0;
      pr.forEach(row => {
        const isVarnish = lam => {
          const l = String(lam || '').toLowerCase();
          return l.includes('varnish') || l.includes('varsnish');
        };
        if (row.lamination && isVarnish(row.lamination) && String(fd.varnishTaskMode || '').toLowerCase() === 'printing') {
          if (isProcessRowCover(row.type)) {
            qVarnishAdd += coverLamCost;
            qLamSub += coverLamCost;
          } else {
            qVarnishAdd += innerLamCost;
            qLamSub += innerLamCost;
          }
        }
      });
    }
    if (totalLaminationAmount > 0) {
      newTaskManager.lamination.selected = true;
      newTaskManager.lamination.machine = 'MACHINE 1';
      newTaskManager.lamination.amount = totalLaminationAmount.toFixed(2);
      if (selectedQuotation && selectedQuotation.results && selectedQuotation.results.length > 0) {
        var _selectedResult$postP2, _selectedResult$padBo4;
        const selectedResult = selectedQuotation.results[fd.selectedOptionIndex || 0] || selectedQuotation.results[0];
        const innerLamCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$postP2 = selectedResult.postPressCosts) === null || _selectedResult$postP2 === void 0 ? void 0 : _selectedResult$postP2.lamCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.lamCost) || 0;
        const coverLamCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo4 = selectedResult.padBookCosts) === null || _selectedResult$padBo4 === void 0 ? void 0 : _selectedResult$padBo4.coverLamCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.coverLaminationCost) || 0;
        const baseLamCost = Math.max(0, innerLamCost + coverLamCost - qLamSub);
        newTaskManager.lamination.quotationAmount = baseLamCost.toFixed(2);
      }
    }
    if (newTaskManager.printing.selected) {
      if (selectedQuotation && selectedQuotation.results && selectedQuotation.results.length > 0) {
        var _selectedResult$baseC3, _selectedResult$padBo5, _selectedResult$padBo6, _selectedResult$padBo7, _selectedResult$padBo8;
        const selectedResult = selectedQuotation.results[fd.selectedOptionIndex || 0] || selectedQuotation.results[0];
        const innerPrintCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$baseC3 = selectedResult.baseCost) === null || _selectedResult$baseC3 === void 0 ? void 0 : _selectedResult$baseC3.totalPrintingCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.printingCost) || 0;
        const coverPrintCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo5 = selectedResult.padBookCosts) === null || _selectedResult$padBo5 === void 0 ? void 0 : _selectedResult$padBo5.coverPrintingCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.coverPrintingCost) || 0;
        const extraPrintCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo6 = selectedResult.padBookCosts) === null || _selectedResult$padBo6 === void 0 ? void 0 : _selectedResult$padBo6.extraPrintingCost) || 0;
        const kappaPrintCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo7 = selectedResult.padBookCosts) === null || _selectedResult$padBo7 === void 0 ? void 0 : _selectedResult$padBo7.kappaPrintingCost) || 0;
        const aaspasPrintCost = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo8 = selectedResult.padBookCosts) === null || _selectedResult$padBo8 === void 0 ? void 0 : _selectedResult$padBo8.aaspasPrintingCost) || 0;
        const totalPrint = innerPrintCost + coverPrintCost + extraPrintCost + kappaPrintCost + aaspasPrintCost;
        const totalPrintWithVarnish = totalPrint + qVarnishAdd;
        newTaskManager.printing.quotationAmount = totalPrintWithVarnish.toFixed(2);
      }
    }
    if (newTaskManager.cutting.selected) {
      if (selectedQuotation && selectedQuotation.results && selectedQuotation.results.length > 0) {
        const selectedResult = selectedQuotation.results[fd.selectedOptionIndex || 0] || selectedQuotation.results[0];
        let qPaper = 0;
        if (innerPaperBy === 'us') {
          var _selectedResult$baseC4;
          qPaper += parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$baseC4 = selectedResult.baseCost) === null || _selectedResult$baseC4 === void 0 ? void 0 : _selectedResult$baseC4.totalPaperCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.paperCost) || 0;
        }
        if (hasCoverPaperFields && coverPaperBy === 'us') {
          var _selectedResult$padBo9;
          qPaper += parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo9 = selectedResult.padBookCosts) === null || _selectedResult$padBo9 === void 0 ? void 0 : _selectedResult$padBo9.coverPaperCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.coverPaperCost) || 0;
        }
        newTaskManager.cutting.quotationAmount = qPaper.toFixed(2);
      }
    }
    if (newTaskManager.binding.selected) {
      if (selectedQuotation && selectedQuotation.results && selectedQuotation.results.length > 0) {
        var _selectedResult$postP3, _selectedResult$padBo0;
        const selectedResult = selectedQuotation.results[fd.selectedOptionIndex || 0] || selectedQuotation.results[0];
        const postPressBind = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$postP3 = selectedResult.postPressCosts) === null || _selectedResult$postP3 === void 0 ? void 0 : _selectedResult$postP3.fabricationCost) || 0;
        const padBookBind = parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : (_selectedResult$padBo0 = selectedResult.padBookCosts) === null || _selectedResult$padBo0 === void 0 ? void 0 : _selectedResult$padBo0.bindingCost) || parseFloat(selectedResult === null || selectedResult === void 0 ? void 0 : selectedResult.bindingCost) || 0;
        const totalBind = postPressBind + padBookBind;
        newTaskManager.binding.quotationAmount = totalBind.toFixed(2);
        if (
          newTaskManager.binding.selected &&
          (!newTaskManager.binding.amount || parseFloat(newTaskManager.binding.amount) <= 0) &&
          totalBind > 0
        ) {
          newTaskManager.binding.amount = totalBind.toFixed(2);
        }
      }
    }
    if ((selectedQuotation === null || selectedQuotation === void 0 ? void 0 : selectedQuotation.productType) === 'Envelope' && (_selectedQuotation$re3 = selectedQuotation.results) !== null && _selectedQuotation$re3 !== void 0 && _selectedQuotation$re3.length) {
      const envR = selectedQuotation.results[fd.selectedOptionIndex || 0] || selectedQuotation.results[0];
      const envCost = v => parseFloat(v) || 0;
      const paper = envCost(envR.paperCost);
      const print = envCost(envR.printingCost);
      const lam = envCost(envR.laminationCost);
      const hasFabTasks = selectedInternalFabs.length > 0 || selectedExternalFabs.length > 0;
      const fabInternalTotal = envCost(envR.internalFabricationAmt);
      const fabExternalTotal = envCost(envR.externalFabricationAmt);
      const ifabBlock = envCost(envR.ifabBlockCost);
      const efabBlock = envCost(envR.efabBlockCost);
      const postBindBase = envCost(envR.makingCost) + envCost(envR.dieCost) + envCost(envR.gummingCost) + envCost(envR.windowCost);
      const postBind = postBindBase + (hasFabTasks ? 0 : fabInternalTotal + fabExternalTotal);
      if (newTaskManager.cutting.selected && paper > 0) {
        newTaskManager.cutting.quotationAmount = paper.toFixed(2);
      }
      if (newTaskManager.printing.selected && print > 0) {
        newTaskManager.printing.quotationAmount = print.toFixed(2);
      }
      if (lam > 0) {
        if (!newTaskManager.lamination.selected) {
          newTaskManager.lamination.selected = true;
          newTaskManager.lamination.machine = 'MACHINE 1';
        }
        newTaskManager.lamination.amount = lam.toFixed(2);
        newTaskManager.lamination.quotationAmount = lam.toFixed(2);
      }
      if (hasFabTasks) {
        const intLines = envR.internalFabrications || [];
        const extLines = envR.externalFabrications || [];
        selectedInternalFabs.forEach((_, idx) => {
          const taskKey = `internalFabrication${idx + 1}`;
          if (!newTaskManager[taskKey]) return;
          let lineAmt = intLines[idx] != null ? envCost(intLines[idx].amount) : 0;
          if (!lineAmt && idx === 0 && intLines.length === 0 && fabInternalTotal > 0) {
            lineAmt = Math.max(0, fabInternalTotal - ifabBlock);
          }
          const qAmt = lineAmt;
          if (qAmt > 0) {
            newTaskManager[taskKey].amount = qAmt.toFixed(2);
            newTaskManager[taskKey].quotationAmount = qAmt.toFixed(2);
          }
        });
        selectedExternalFabs.forEach((_, idx) => {
          const taskKey = `externalFabrication${idx + 1}`;
          if (!newTaskManager[taskKey]) return;
          let lineAmt = extLines[idx] != null ? envCost(extLines[idx].amount) : 0;
          if (!lineAmt && idx === 0 && extLines.length === 0 && fabExternalTotal > 0) {
            lineAmt = Math.max(0, fabExternalTotal - efabBlock);
          }
          const jointExtra = idx === 0 ? ifabBlock + efabBlock : 0;
          const qAmt = lineAmt + jointExtra;
          if (qAmt > 0) {
            newTaskManager[taskKey].amount = qAmt.toFixed(2);
            newTaskManager[taskKey].quotationAmount = qAmt.toFixed(2);
          }
        });
      }
      if (postBind > 0) {
        newTaskManager.binding.selected = true;
        newTaskManager.binding.machine = 'INTERNAL';
        newTaskManager.binding.amount = postBind.toFixed(2);
        newTaskManager.binding.quotationAmount = postBind.toFixed(2);
      }
    }
    if ((selectedQuotation === null || selectedQuotation === void 0 ? void 0 : selectedQuotation.productType) === 'CutToSheet' && Array.isArray(selectedQuotation.results) && selectedQuotation.results.length > 0) {
      const selIdx = fd.selectedOptionIndex !== '' && fd.selectedOptionIndex != null ? parseInt(fd.selectedOptionIndex, 10) : 0;
      const safeIdx = Number.isFinite(selIdx) ? selIdx : 0;
      const r = selectedQuotation.results[safeIdx] || selectedQuotation.results[0];
      const extLines = Array.isArray(r.externalFabrications) ? r.externalFabrications : [];
      const intLines = Array.isArray(r.internalFabrications) ? r.internalFabrications : [];
      const jointLines = Array.isArray(r.efabJointProducts) ? r.efabJointProducts : [];
      selectedInternalFabs.forEach((_, idx) => {
        const taskKey = `internalFabrication${idx + 1}`;
        if (!newTaskManager[taskKey] || !intLines[idx]) return;
        const amt = parseFloat(intLines[idx].amount) || 0;
        if (amt > 0) {
          newTaskManager[taskKey].quotationAmount = amt.toFixed(2);
          newTaskManager[taskKey].amount = amt.toFixed(2);
        }
      });
      selectedExternalFabs.forEach((fabId, idx) => {
        var _fd$externalFabricati2;
        const taskKey = `externalFabrication${idx + 1}`;
        const fab = (externalFabrications || []).find(f => String(f.id) === String(fabId));
        if (newTaskManager[taskKey] && extLines[idx]) {
          const amt = parseFloat(extLines[idx].amount) || 0;
          if (amt > 0) {
            newTaskManager[taskKey].quotationAmount = amt.toFixed(2);
            newTaskManager[taskKey].amount = amt.toFixed(2);
          }
        }
        const jointNames = parseJointProductNames((_fd$externalFabricati2 = fd.externalFabricationJointProducts) === null || _fd$externalFabricati2 === void 0 ? void 0 : _fd$externalFabricati2[idx]);
        jointNames.forEach((jointName, jIdx) => {
          const jKey = externalFabJointTaskKey(idx, jIdx);
          if (!newTaskManager[jKey]) return;
          const normJoint = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const jn = normJoint(jointName);
          const line = jointLines.find(j => {
            const jt = normJoint(j.type);
            return jt === jn || jt.includes(jn) || jn.includes(jt);
          });
          let amt = line != null ? parseFloat(line.cost) || 0 : 0;
          if (amt <= 0) amt = getJointProductRateFromFab(fab, jointName);
          newTaskManager[jKey].amount = amt > 0 ? amt.toFixed(2) : '';
          newTaskManager[jKey].quotationAmount = amt > 0 ? amt.toFixed(2) : '';
        });
      });
    }

    /** Custom Calculator stores inner/cover external fab ₹ in padBookCosts, not in externalFabrications[]. */
    if (isBookletsProductType(selectedQuotation === null || selectedQuotation === void 0 ? void 0 : selectedQuotation.productType) && Array.isArray(selectedQuotation.results) && selectedQuotation.results.length > 0 && selectedExternalFabs.length > 0) {
      const selIdx = fd.selectedOptionIndex !== '' && fd.selectedOptionIndex != null ? parseInt(fd.selectedOptionIndex, 10) : 0;
      const safeIdx = Number.isFinite(selIdx) ? selIdx : 0;
      const r = selectedQuotation.results[safeIdx] || selectedQuotation.results[0];
      const pb = (r === null || r === void 0 ? void 0 : r.padBookCosts) || {};
      const innerAmt = Number(pb.innerExternalFabricationCost) || 0;
      const coverTotal = Number(pb.bookletCoverFabExternalCost) || 0;
      const inputsMerged = mergeQuotationInputsForJobCard(selectedQuotation, r);
      const hasInnerFab = inputsMerged.bookletExternalFabrication != null && String(inputsMerged.bookletExternalFabrication).trim() !== '' && String(inputsMerged.bookletExternalFabrication) !== 'none';
      const n = selectedExternalFabs.length;
      const tailCount = hasInnerFab ? Math.max(0, n - 1) : n;
      const perCoverTail = tailCount > 0 ? coverTotal / tailCount : 0;
      selectedExternalFabs.forEach((_, idx) => {
        const taskKey = `externalFabrication${idx + 1}`;
        if (!newTaskManager[taskKey]) return;
        let qAmt = 0;
        if (hasInnerFab) {
          if (idx === 0) qAmt = innerAmt;else if (tailCount > 0) qAmt = perCoverTail;
        } else if (n > 0) {
          qAmt = (innerAmt + coverTotal) / n;
        }
        if (qAmt > 0.005) {
          newTaskManager[taskKey].quotationAmount = qAmt.toFixed(2);
          newTaskManager[taskKey].amount = qAmt.toFixed(2);
        }
      });
    }

    // Calculate total billing amount
    const totalAmount = Object.values(newTaskManager).filter(task => task.selected).reduce((sum, task) => {
      // Exclude billing from its own total
      if (task === newTaskManager.billing) return sum;
      return sum + (parseFloat(task.amount) || 0);
    }, 0);
    newTaskManager.billing.amount = totalAmount.toFixed(2);

    // Calculate total quotation amount for billing
    const totalQuotationAmount = Object.values(newTaskManager).filter(task => task.selected).reduce((sum, task) => {
      if (task === newTaskManager.billing) return sum;
      return sum + (parseFloat(task.quotationAmount) || 0);
    }, 0);
    newTaskManager.billing.quotationAmount = totalQuotationAmount.toFixed(2);
    setTaskManager(prev => {
      const merged = {
        ...newTaskManager
      };
      if (prev) {
        Object.keys(merged).forEach(taskKey => {
          if (prev[taskKey]) {
            const isFab = taskKey.startsWith('internalFabrication') || taskKey.startsWith('externalFabrication');
            const fabIdChanged = isFab && prev[taskKey].fabricationId !== merged[taskKey].fabricationId;

            merged[taskKey].instructions = prev[taskKey].instructions || merged[taskKey].instructions;
            merged[taskKey].amountSource = prev[taskKey].amountSource || merged[taskKey].amountSource;
            
            if (fabIdChanged) {
              merged[taskKey].selected = true;
            } else {
              merged[taskKey].user = prev[taskKey].user ?? merged[taskKey].user;
              if (preserveSelections) {
                merged[taskKey].selected = prev[taskKey].selected;
              }
            }
          }
        });
        // Copy any custom/special keys from prev that are not in merged (e.g. pc2Plate, printingTaskState)
        Object.keys(prev).forEach(key => {
          if (!merged.hasOwnProperty(key)) {
            if (!key.startsWith('internalFabrication') && 
                !key.startsWith('externalFabrication') && 
                !key.startsWith('externalFabJoint_')) {
              merged[key] = prev[key];
            }
          }
        });
      }
      if (preserveSelections && merged.billing) {
        const totalAmount = Object.values(merged).filter(task => task.selected).reduce((sum, task) => {
          if (task === merged.billing) return sum;
          return sum + (parseFloat(task.amount) || 0);
        }, 0);
        const totalQuotationAmount = Object.values(merged).filter(task => task.selected).reduce((sum, task) => {
          if (task === merged.billing) return sum;
          return sum + (parseFloat(task.quotationAmount) || 0);
        }, 0);
        merged.billing.amount = totalAmount.toFixed(2);
        merged.billing.quotationAmount = totalQuotationAmount.toFixed(2);
        merged.billing.selected = true;
      }
      return ensureExternalFabJointTasksInTaskManager(merged, fd, internalFabrications, externalFabrications);
    });
  };
  useEffect(() => {
    let opts = {};
    if (editingJobCard) {
      // Avoid overwriting taskManager state on initial load in edit mode
      const loadedInt = normalizeFabSelection(editingJobCard.internalFabrications || editingJobCard.internalFabrication, internalFabrications);
      const loadedExt = normalizeFabSelection(editingJobCard.externalFabrications || editingJobCard.externalFabrication, externalFabrications);
      const currentInt = normalizeFabSelection(formData.internalFabrications);
      const currentExt = normalizeFabSelection(formData.externalFabrications);

      const intChanged = JSON.stringify(loadedInt) !== JSON.stringify(currentInt);
      const extChanged = JSON.stringify(loadedExt) !== JSON.stringify(currentExt);

      if (!intChanged && !extChanged) {
        return;
      }
      opts.preserveSelections = true;
    }
    autoSelectTasks(formData, undefined, opts);
  }, [JSON.stringify(formData.internalFabrications || []), JSON.stringify(formData.externalFabrications || []), JSON.stringify(formData.externalFabricationJointProducts || {}), editingJobCard]);
  useEffect(() => {
    const visibleTaskKeys = Object.keys(taskManager).filter(taskName => taskName !== 'printing2' && taskName !== 'customOrder' && taskName !== '__customOrder' && taskName !== 'varnishTaskMode');
    setTaskOrder(prev => {
      const visibleWithoutBilling = visibleTaskKeys.filter(taskName => taskName !== 'billing');
      const kept = prev.filter(taskName => taskName !== 'billing' && visibleWithoutBilling.includes(taskName));
      const added = visibleWithoutBilling.filter(taskName => !kept.includes(taskName));
      const next = [...kept, ...added];
      if (visibleTaskKeys.includes('billing')) next.push('billing');
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [taskManager]);
  const isReorderableTask = taskName => String(taskName).startsWith('internalFabrication') || String(taskName).startsWith('externalFabrication') || String(taskName).startsWith('externalFabJoint_') || String(taskName) === 'binding';
  const normalizeTaskStatus = status => {
    const s = String(status || '').trim().toUpperCase();
    if (!s) return '';
    if (s === 'READY_DISPATCH') return 'READY TO DISPATCH';
    if (s === 'END') return 'IN PROGRESS';
    if (s === 'START') return 'STARTED';
    return s;
  };
  const handleTaskDragStart = taskName => {
    if (!isReorderableTask(taskName)) return;
    setDragTaskName(taskName);
  };
  const handleTaskDragOver = (event, targetTaskName) => {
    if (!dragTaskName || !isReorderableTask(targetTaskName)) return;
    event.preventDefault();
  };
  const handleTaskDrop = targetTaskName => {
    if (targetTaskName === 'billing') return;
    if (!dragTaskName || dragTaskName === targetTaskName) return;
    if (isTaskRowLocked(dragTaskName) || isTaskRowLocked(targetTaskName)) {
      setDragTaskName('');
      return;
    }
    setTaskOrder(prev => {
      const fromIndex = prev.indexOf(dragTaskName);
      const toIndex = prev.indexOf(targetTaskName);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      if (next.includes('billing')) {
        const withoutBilling = next.filter(taskName => taskName !== 'billing');
        return [...withoutBilling, 'billing'];
      }
      return next;
    });
    setDragTaskName('');
  };
  const visibleTaskManagerKeys = Object.keys(taskManager).filter(
    (taskName) =>
      taskName !== 'printing2' &&
      taskName !== 'customOrder' &&
      taskName !== '__customOrder' &&
      taskName !== 'varnishTaskMode'
  );
  const taskManagerRowOrder = taskOrder.length > 0 ? taskOrder : visibleTaskManagerKeys;
  const getTaskManagerRowLabel = (taskName) => {
    const taskLabels = {
      cutting: 'CUTTING',
      printing: 'PRINTING',
      lamination: 'LAMINATION',
      binding: 'BINDING',
      billing: 'BILLING'
    };
    if (taskLabels[taskName]) return taskLabels[taskName];
    if (
      taskName.startsWith('internalFabrication')
      || taskName.startsWith('externalFabrication')
      || taskName.startsWith('externalFabJoint_')
    ) {
      const taskData = taskManager[taskName];
      const cat = resolveJobCardFabTaskCategory(
        taskData,
        internalFabrications,
        externalFabrications,
        taskName,
        formData
      );
      if (cat === 'punching') return 'PUNCHING TASK';
      if (cat === 'binding') return 'BINDING';
      if (taskName.startsWith('internalFabrication')) return 'INTERNAL';
      return 'EXTERNAL PRE';
    }
    if (taskName === 'externalFabricationVarnish') return 'EXTERNAL VARNISH';
    return String(taskName).toUpperCase();
  };
  const getTaskLabelsColumnValue = (tName, tData) => {
    if (tName === 'cutting') return '-';
    if (tName === 'printing') {
      const printMachine = tData.machine || '-';
      if (hasVarnishInProcessRows && String(formData.varnishTaskMode || '').toLowerCase() === 'printing') {
        return [printMachine, varnishInstructionLabel].filter(Boolean).join(' / ');
      }
      return printMachine;
    }
    if (tName === 'lamination') {
      const lamNames = Array.from(
        new Set(
          (processRows || [])
            .map((r) => r.lamination)
            .filter(Boolean)
            .filter((lam) => {
              const l = String(lam || '').toLowerCase();
              return !l.includes('varnish') && !l.includes('varsnish');
            })
        )
      );
      return lamNames.join(', ') || '-';
    }
    if (tName === 'binding') return formData.bindingProduct || '-';
    if (tName === 'billing') return '-';
    if (
      tName.startsWith('internalFabrication') ||
      tName.startsWith('externalFabrication') ||
      tName.startsWith('externalFabJoint_') ||
      tName === 'externalFabricationVarnish'
    ) {
      return tData.fabricationName || '-';
    }
    return tData.machine || '-';
  };
  const mapEnvelopePrintingToJobCardForms = printingType => {
    const p = String(printingType || '').toLowerCase();
    if (p.startsWith('both')) return 'frontback';
    if (p.startsWith('one')) return 'oneside';
    return 'oneside';
  };
  const parseEnvelopeSheetKeyFromResult = opt => {
    if (!opt) return '';
    const label = String(opt.bestFitSheet || '');
    const first = label.split(/\s+/)[0];
    if (first && /^\d/.test(first)) return first.replace(/×/g, 'x').replace(/X/g, 'x').toLowerCase();
    const m = label.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    return m ? `${m[1]}x${m[2]}` : '';
  };
  const machineFromEnvelopePrintField = (printMachineField, printingType, sheetKey) => {
    const raw = String(printMachineField || '').toLowerCase();
    /* Envelope.js uses ENVELOPE_PRINT_PRESSES: "Komori" (560×670) vs "Komori 29" (605×760). */
    if (raw.includes('komori 29') || raw.includes('komori29')) return 'Komori 529';
    if (raw.includes('komori')) return 'Komori 426';
    return getMachineForProcess(printingType || 'oneside', sheetKey || '18x25');
  };
  const removeProcessRow = index => {
    if (processRows.length > 1) {
      const newRows = processRows.filter((_, i) => i !== index);
      setProcessRows(newRows);
      setTimeout(() => autoSelectTasks(formData, newRows), 0);
    }
  };
  const getProcessDetailsFromQuotationData = (quotation, optionIndex = 0) => {
    const results = quotation.results || [];
    const selectedResult = results[optionIndex] || results[0];
    const inputs = mergeQuotationInputsForJobCard(quotation, selectedResult);
    const productType = quotation.productType;
    let processRows = [];
    if ((productType === 'CutToSheet' || isBookletsProductType(productType)) && results.length > 0) {
      const result = selectedResult;
      const bestFit = result.bestFitDetails || {};
      const runDetails = bestFit.runDetails || [];
      const groupedRuns = runDetails.reduce((acc, run) => {
        const key = `${run.method}|${run.sheetsNeeded}`;
        if (!acc[key]) {
          acc[key] = {
            ...run,
            formCount: 0
          };
        }
        acc[key].formCount++;
        return acc;
      }, {});
      Object.values(groupedRuns).forEach(run => {
        let forms = run.method === 'frontback' ? 'frontback' : run.method === 'selfback' ? 'selfback' : run.method === 'doublegripper' ? 'double_gripper' : 'oneside';
        const net = parseInt(run.sheetsNeeded, 10) || 0;
        const gross = parseInt(run.sheets, 10) || 0;
        const wExplicit = parseInt(run.wastage, 10);
        let wastageSheets = 0;
        if (Number.isFinite(wExplicit) && wExplicit >= 0) {
          wastageSheets = wExplicit;
        } else if (gross > net) {
          wastageSheets = gross - net;
        }
        const totalSheets = gross > 0 ? gross : net + wastageSheets;
        processRows.push({
          forms: forms,
          sideCount: run.formCount.toString(),
          qty: net.toString(),
          sheets: totalSheets.toString(),
          extraSheets: String(wastageSheets),
          type: 'inner',
          remark: '',
          machine: getMachineForProcess(inputs.printingType, bestFit.sheet ? `${bestFit.sheet.width}x${bestFit.sheet.height}` : '', result.machineName),
          lamination: getLaminationNameFromQuotationValue(result.inputs && result.inputs.lamination || inputs.lamination)
        });
      });
      if (isBookletsProductType(productType) && processRows.length > 0) {
        const cg = parseFloat(inputs.bookletCoverGsm || inputs.padCoverGsm || inputs.visualateCoverGsm || '0');
        const hasBind = inputs.bookletBindingType && inputs.bookletBindingType !== 'none' || inputs.padBindingType && inputs.padBindingType !== 'none' || inputs.visualateBinding;
        if (hasBind && cg > 0) {
          const paperSize = inputs.size || inputs.paperSize || 'A4';
          const coverPrintingType = inputs.bookletCoverPrinting || inputs.padCoverPrinting || inputs.visualateCoverPrinting || 'multi';
          const padCover = getPadBookCoverQuantitiesFromResult(result);
          const covLam = inputs.bookletCoverLamination || inputs.padCoverLamination || inputs.visualateCoverLamination;
          if (padCover) {
            const coverFitKey = padCover.cutW != null && padCover.cutH != null ? `${padCover.cutW}x${padCover.cutH}`.replace(/\s+/g, '') : getFitSheetSizeForBooklet(paperSize, coverPrintingType);
            const coverMachine = padCover.machineName && String(padCover.machineName).trim() || getMachineForProcess(coverPrintingType, coverFitKey);
            processRows.push({
              forms: padCover.forms,
              sideCount: '1',
              qty: padCover.netCutSheets.toString(),
              sheets: padCover.totalCutSheets.toString(),
              extraSheets: padCover.wastageSheets.toString(),
              type: 'cover',
              remark: '',
              machine: coverMachine,
              lamination: getLaminationNameFromQuotationValue(covLam)
            });
          } else {
            const coverFitSheet = getFitSheetSizeForBooklet(paperSize, coverPrintingType);
            const coverMachine = getMachineForProcess(coverPrintingType, coverFitSheet);
            const bookletSelected = paperOptions.find(p => p.value === paperSize);
            const bookletUps = (bookletSelected === null || bookletSelected === void 0 ? void 0 : bookletSelected.ups) || 1;
            const qty = parseInt(inputs.qty || 0, 10);
            const coverWastage = qty / 2 <= 2100 ? 100 : qty / 2 <= 4000 ? 150 : qty / 2 <= 5000 ? 200 : qty / 2 <= 9000 ? 250 : qty / 2 <= 15000 ? 350 : 500;
            const coverQtyCutSheet = Math.ceil(qty * 4 / bookletUps);
            const totalCoverSheets = coverQtyCutSheet + coverWastage;
            const coverFormType = bookletUps === 4 ? 'frontback' : 'selfback';
            processRows.push({
              forms: coverFormType,
              sideCount: '1',
              qty: coverQtyCutSheet.toString(),
              sheets: totalCoverSheets.toString(),
              extraSheets: coverWastage.toString(),
              type: 'cover',
              remark: '',
              machine: coverMachine,
              lamination: getLaminationNameFromQuotationValue(covLam)
            });
          }
        }
      }
    } else if (productType === 'Booklet' && results.length > 0) {
      const firstResult = results[optionIndex] || results[0];
      const resultInputs = mergeQuotationInputsForJobCard(quotation, firstResult);
      const formDetails = firstResult.formDetails || [];
      const originalQty = firstResult.qty || 0;
      const wastage = firstResult.wastage || 0;
      const paperSize = resultInputs.size || inputs.paperSize;
      const printingType = resultInputs.printing || inputs.printingType;
      const fitSheetSize = getFitSheetSizeForBooklet(paperSize, printingType);
      const machine = getMachineForProcess(printingType, fitSheetSize);

      // Group form details by type (frontback/selfback)
      const groupedDetails = (() => {
        if (!Array.isArray(formDetails)) {
          return [];
        }
        const grouped = formDetails.reduce((acc, form) => {
          const formType = form.type === 'Full' ? 'frontback' : 'selfback';
          if (!acc[formType]) {
            acc[formType] = {
              formCount: 0,
              totalSheets: 0
            };
          }
          acc[formType].formCount++;
          acc[formType].totalSheets += Math.ceil(form.sheets);
          return acc;
        }, {});
        const results = [];
        Object.keys(grouped).forEach(formType => {
          const group = grouped[formType];
          const formsOfType = formDetails.filter(form => (form.type === 'Full' ? 'frontback' : 'selfback') === formType);

          // Validation for selfback grouping - only allow if all quantities are identical
          if (formType === 'selfback' && formsOfType.length > 1) {
            const quantities = formsOfType.map(form => Math.ceil(originalQty * form.multiplier));
            const firstQty = quantities[0];
            const allIdentical = quantities.every(qty => qty === firstQty);
            if (!allIdentical) {
              // Don't group selfback forms with different quantities - process them separately
              formsOfType.forEach(form => {
                const qty = Math.ceil(originalQty * form.multiplier);
                results.push({
                  forms: formType,
                  sideCount: '1',
                  qty: qty.toString(),
                  sheets: Math.ceil(form.sheets).toString(),
                  extraSheets: wastage.toString(),
                  type: 'inner',
                  remark: '',
                  machine: machine,
                  lamination: getLaminationNameFromQuotationValue(resultInputs.lamination)
                });
              });
              return; // Skip the grouped processing for this formType
            }
          }

          // Normal grouping for identical quantities or frontback forms
          const firstForm = formsOfType[0];
          const qty = firstForm ? Math.ceil(originalQty * firstForm.multiplier) : 0;
          results.push({
            forms: formType,
            sideCount: group.formCount.toString(),
            qty: qty.toString(),
            sheets: group.totalSheets.toString(),
            extraSheets: wastage.toString(),
            type: 'inner',
            remark: '',
            machine: machine,
            lamination: getLaminationNameFromQuotationValue(resultInputs.lamination)
          });
        });
        return results;
      })();
      processRows.push(...groupedDetails);

      // Handle Cover details separately
      if (resultInputs.coverGsm && parseInt(resultInputs.coverGsm) > 0) {
        const coverPrintingType = resultInputs.coverPrintingColor || '';
        const coverFitSheet = getFitSheetSizeForBooklet(paperSize, coverPrintingType);
        const coverMachine = getMachineForProcess(coverPrintingType, coverFitSheet);
        const bookletSelected = paperOptions.find(p => p.value === paperSize);
        const bookletUps = (bookletSelected === null || bookletSelected === void 0 ? void 0 : bookletSelected.ups) || 1;
        const qty = parseInt(firstResult.qty || 0);
        const coverWastage = qty / 2 <= 2100 ? 100 : qty / 2 <= 4000 ? 150 : qty / 2 <= 5000 ? 200 : qty / 2 <= 9000 ? 250 : qty / 2 <= 15000 ? 350 : 500;
        const coverQtyCutSheet = Math.ceil(qty * 4 / bookletUps);
        const totalCoverSheets = coverQtyCutSheet + coverWastage;
        const coverFormType = bookletUps === 4 ? 'frontback' : 'selfback';
        processRows.push({
          forms: coverFormType,
          sideCount: '1',
          // Cover is typically a single form
          qty: coverQtyCutSheet.toString(),
          sheets: totalCoverSheets.toString(),
          extraSheets: coverWastage.toString(),
          type: 'cover',
          remark: '',
          machine: coverMachine,
          lamination: getLaminationNameFromQuotationValue(resultInputs.coverLamination)
        });
      }
    } else if (productType === 'Envelope' && results.length > 0) {
      var _result$laminationTyp;
      const result = selectedResult;
      const envInputs = quotation.inputs || {};
      const pt = result.printingType || envInputs.printingType || '';
      const forms = mapEnvelopePrintingToJobCardForms(pt);
      const ups = parseInt(result.ups || 1, 10) || 1;
      const qty = parseInt(result.quantity || envInputs.quantity || 0, 10) || 0;
      const totalSheets = parseInt(result.totalSheets || 0, 10) || 0;
      const netSheets = ups > 0 ? Math.ceil(qty / ups) : totalSheets;
      const wastage = totalSheets > netSheets ? totalSheets - netSheets : 0;
      const sheetKey = parseEnvelopeSheetKeyFromResult(result);
      const machine = getMachineForProcess(pt, sheetKey || '18x25', result.machineName || machineFromEnvelopePrintField(result.printMachine, pt, sheetKey));
      const lamVal = (_result$laminationTyp = result.laminationType) !== null && _result$laminationTyp !== void 0 ? _result$laminationTyp : envInputs.laminationType;
      processRows = [{
        forms,
        sideCount: '1',
        qty: String(netSheets || totalSheets || ''),
        sheets: String(totalSheets || netSheets || ''),
        extraSheets: String(wastage),
        type: 'inner',
        remark: '',
        machine,
        lamination: getLaminationNameFromQuotationValue(lamVal)
      }];
    }
    return processRows.length > 0 ? processRows : [{
      remark: '',
      forms: '',
      sideCount: '',
      qty: '',
      extraSheets: '',
      plates: '',
      type: '',
      machine: '',
      lamination: ''
    }];
  };
  const getSheetSizeFromOption = selectedOption => {
    var _selectedOption$bestF, _selectedOption$baseC;
    const bestFitSheet = (selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$bestF = selectedOption.bestFitDetails) === null || _selectedOption$bestF === void 0 ? void 0 : _selectedOption$bestF.sheet) || (selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$baseC = selectedOption.baseCost) === null || _selectedOption$baseC === void 0 ? void 0 : _selectedOption$baseC.sheet);
    if (!bestFitSheet) return '';
    if (typeof bestFitSheet === 'string') {
      return bestFitSheet;
    }
    if (typeof bestFitSheet === 'object' && bestFitSheet.width && bestFitSheet.height) {
      return `${bestFitSheet.width}x${bestFitSheet.height}`;
    }
    return '';
  };
  const toNumericValue = value => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const normalizeSheetSize = sheetSize => {
    if (!sheetSize || typeof sheetSize !== 'string') return '';
    return sheetSize.replace(/\s+/g, '').toLowerCase();
  };
  const calculateUpsFromSizes = (fullSize, cutSize) => {
    const full = parseCutSize(fullSize);
    const cut = parseCutSize(cutSize);
    if (!full.length || !full.width || !cut.length || !cut.width) {
      return 0;
    }
    const normalFit = Math.floor(full.length / cut.length) * Math.floor(full.width / cut.width);
    const rotatedFit = Math.floor(full.length / cut.width) * Math.floor(full.width / cut.length);
    return Math.max(normalFit, rotatedFit, 0);
  };
  const normalizeFabSelection = (value, masterRows = []) => {
    const resolveFabValue = item => {
      if (item == null) return '';
      if (typeof item === 'object') {
        const rawId = item.id;
        if (rawId != null && String(rawId).trim() !== '') return String(rawId).trim();
        const productName = String(item.product || item.description || item.name || item.type || '').trim();
        if (!productName) return '';
        const matched = (masterRows || []).find(fab => getFabLabel(fab).trim().toLowerCase() === productName.toLowerCase());
        return matched !== null && matched !== void 0 && matched.id ? String(matched.id).trim() : productName;
      }
      const raw = String(item).trim();
      const matched = (masterRows || []).find(fab => getFabLabel(fab).trim().toLowerCase() === raw.toLowerCase());
      return matched !== null && matched !== void 0 && matched.id ? String(matched.id).trim() : raw;
    };
    if (Array.isArray(value)) {
      return value.map(resolveFabValue).filter(Boolean);
    }
    if (value == null || value === '') return [];
    return [resolveFabValue(value)].filter(Boolean);
  };
  const getFabLabel = fab => (fab === null || fab === void 0 ? void 0 : fab.product) || (fab === null || fab === void 0 ? void 0 : fab.description) || (fab === null || fab === void 0 ? void 0 : fab.name) || '';
  const calculateFabricationAmount = (fab, {
    qty,
    sheets,
    leaves
  }) => {
    var _ref6, _fab$rate, _ref7, _fab$minimumAmt, _ref8, _fab$calcType;
    if (!fab) return 0;
    const rate = parseFloat((_ref6 = (_fab$rate = fab.rate) !== null && _fab$rate !== void 0 ? _fab$rate : fab.price) !== null && _ref6 !== void 0 ? _ref6 : 0) || 0;
    const minimumAmt = parseFloat((_ref7 = (_fab$minimumAmt = fab.minimumAmt) !== null && _fab$minimumAmt !== void 0 ? _fab$minimumAmt : fab.minimumamt) !== null && _ref7 !== void 0 ? _ref7 : 0) || 0;
    const calcType = String((_ref8 = (_fab$calcType = fab.calcType) !== null && _fab$calcType !== void 0 ? _fab$calcType : fab.calctype) !== null && _ref8 !== void 0 ? _ref8 : 'qty').toLowerCase();
    const qtyValue = parseFloat(qty) || 0;
    const sheetValue = parseFloat(sheets) || 0;
    const leavesValue = parseFloat(leaves) || 1;
    let amount = 0;
    if (calcType === 'sheet') {
      amount = sheetValue / 1000 * rate;
    } else if (calcType === 'fixed') {
      amount = rate;
    } else if (calcType === 'forms') {
      amount = leavesValue * qtyValue / 1000 * rate;
    } else if (calcType === 'qty_rate') {
      const merged = resolveFabricationPricingRow(fab, externalFabrications);
      amount = qtyValue * getEffectivePerPieceRateForQtyRate(merged, qtyValue);
    } else {
      amount = qtyValue / 1000 * rate;
    }
    return Math.max(amount, minimumAmt);
  };
  const getFabJointProducts = fab => {
    var _fab$jointProducts3;
    if (!fab) return [];
    const list = (_fab$jointProducts3 = fab.jointProducts) !== null && _fab$jointProducts3 !== void 0 ? _fab$jointProducts3 : fab.jointproducts;
    if (Array.isArray(list)) {
      return list.filter(joint => joint && joint.product);
    }
    if (fab.jointProduct) {
      return [{
        product: fab.jointProduct,
        rate: fab.jointProductRate || 0
      }];
    }
    return [];
  };
  const parseJointProductNames = selected => String(selected !== null && selected !== void 0 ? selected : '').split(',').map(s => s.trim()).filter(Boolean);
  const getJointProductRateFromFab = (fab, productName) => {
    const name = String(productName || '').trim();
    if (!name || !fab) return 0;
    const joint = getFabJointProducts(fab).find(item => String(item.product || '').trim().toLowerCase() === name.toLowerCase());
    return parseFloat((joint === null || joint === void 0 ? void 0 : joint.rate) || 0) || 0;
  };
  const getSelectedJointAmount = (fab, selectedProduct) => parseJointProductNames(selectedProduct).reduce((sum, jointName) => sum + getJointProductRateFromFab(fab, jointName), 0);
  const autoFillFromSelectedOption = (selectedOption, quotation, optionIndex) => {
    var _quotation$inputs, _selectedOption$poste, _ref9, _selectedOption$gummi, _ref0, _selectedOption$gummi2, _ref1, _selectedOption$noOfS, _ref10, _selectedOption$gummi3, _quotation$inputs3;
    const inputs = mergeQuotationInputsForJobCard(quotation, selectedOption);
    const bestFit = selectedOption.bestFitDetails || null;
    const bookletLayout = buildBookletLayoutInputsForJobCard(quotation, inputs);

    const autofilledPages = inputs.pages || inputs.noOfLeaves || '';
    const autofilledSize = resolveAutofilledJobCardSizeFromQuotation(inputs);

    // Generate process details for this specific option
    const autoFilledProcessRows = getProcessDetailsFromQuotationData(quotation, optionIndex);
    setProcessRows(autoFilledProcessRows);
    const filledRows = autoFilledProcessRows.filter(row => row.forms !== '');
    if (filledRows.length > 0) {
      setProcessDetailsAutoFilled(true);
      setTimeout(() => setProcessDetailsAutoFilled(false), 5000);
    }
    let sheetSize = '';
    let totalSheets = 0;
    let jobUps = 1;
    let paperGsm = '';
    let paperType = '';
    let jobColor = '';
    let paperBy = inputs.paperBy || ((_quotation$inputs = quotation.inputs) === null || _quotation$inputs === void 0 ? void 0 : _quotation$inputs.paperBy) || 'us';
    if ((quotation.productType === 'CutToSheet' || isBookletsProductType(quotation.productType)) && bestFit !== null && bestFit !== void 0 && bestFit.sheet) {
      var _selectedOption$baseC2;
      sheetSize = getSheetSizeFromOption(selectedOption);
      totalSheets = bestFit.grandTotalSheets || (selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$baseC2 = selectedOption.baseCost) === null || _selectedOption$baseC2 === void 0 ? void 0 : _selectedOption$baseC2.grandTotalSheets) || 0;
      const cutSizeData = getCutSizeToSheetMapping(sheetSize);
      jobUps = cutSizeData ? cutSizeData.ups : bestFit.ups || 1;
      paperGsm = inputs.gsm || '';
      paperType = inputs.paperType || '';
      jobColor = inputs.printingType || '';
      if (isBookletsProductType(quotation.productType) && bookletLayout && parseFloat(String(bookletLayout.coverGsm || '0')) > 0) {
        setShowCoverPaper(true);
      }
    } else if (quotation.productType === 'Booklet') {
      const resultInputs = inputs;
      const paperSize = resultInputs.size || resultInputs.paperSize;
      const printingType = resultInputs.printing || resultInputs.printingType;
      sheetSize = getFitSheetSizeForBooklet(paperSize, printingType);
      const pages = parseInt(resultInputs.pages || 0);
      const qty = parseInt(resultInputs.qty || resultInputs.qty1 || 0);
      const selectedPaperOption = paperOptions.find(p => p.value === paperSize);
      const bookletUps = (selectedPaperOption === null || selectedPaperOption === void 0 ? void 0 : selectedPaperOption.ups) || 1;
      totalSheets = Math.ceil((qty + 100) * pages / bookletUps);
      const cutSizeData = getCutSizeToSheetMapping(sheetSize);
      jobUps = cutSizeData ? cutSizeData.ups : 1;
      paperGsm = resultInputs.gsm || '';
      paperType = resultInputs.paperType || '';
      jobColor = resultInputs.printing || resultInputs.printingType || '';
      setShowCoverPaper(true);
    } else if (quotation.productType === 'Envelope') {
      const opt = selectedOption || {};
      const envIn = inputs;
      const qty = parseInt(opt.quantity || envIn.quantity || 0, 10) || 0;
      const ups = parseInt(opt.ups || 1, 10) || 1;
      let totalSheetsVal = parseInt(opt.totalSheets || 0, 10) || 0;
      const netSheets = ups > 0 ? Math.ceil(qty / ups) : totalSheetsVal;
      if (!totalSheetsVal && netSheets) totalSheetsVal = netSheets;
      const wastage = totalSheetsVal > netSheets ? totalSheetsVal - netSheets : 0;
      const sheetKey = parseEnvelopeSheetKeyFromResult(opt);
      sheetSize = sheetKey || '';
      totalSheets = totalSheetsVal || netSheets || qty;
      jobUps = ups || 1;
      paperGsm = envIn.gsm != null ? String(envIn.gsm) : '';
      paperType = envIn.paperType || '';
      jobColor = envIn.printingType || opt.printingType || '';
      setShowCoverPaper(false);
    } else {
      var _selectedOption$bestF2, _selectedOption$baseC3, _quotation$inputs2, _selectedOption$bestF3, _selectedOption$baseC4;
      sheetSize = getSheetSizeFromOption(selectedOption);
      totalSheets = (selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$bestF2 = selectedOption.bestFitDetails) === null || _selectedOption$bestF2 === void 0 ? void 0 : _selectedOption$bestF2.grandTotalSheets) || (selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$baseC3 = selectedOption.baseCost) === null || _selectedOption$baseC3 === void 0 ? void 0 : _selectedOption$baseC3.grandTotalSheets) || (selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.grandTotalSheets) || (selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.sheets) || (selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.totalSheets) || (inputs === null || inputs === void 0 ? void 0 : inputs.qty) || 0;
      const cutSizeData = getCutSizeToSheetMapping(sheetSize);
      const derivedUps = calculateUpsFromSizes(sheetSize, ((_quotation$inputs2 = quotation.inputs) === null || _quotation$inputs2 === void 0 ? void 0 : _quotation$inputs2.cutSize) || (selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.cutSize) || '');
      jobUps = (cutSizeData === null || cutSizeData === void 0 ? void 0 : cutSizeData.ups) || (selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$bestF3 = selectedOption.bestFitDetails) === null || _selectedOption$bestF3 === void 0 ? void 0 : _selectedOption$bestF3.ups) || (selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$baseC4 = selectedOption.baseCost) === null || _selectedOption$baseC4 === void 0 ? void 0 : _selectedOption$baseC4.ups) || derivedUps || 1;
      paperGsm = inputs.gsm || selectedOption.gsm || '';
      paperType = inputs.paperType || selectedOption.paperType || '';
      jobColor = inputs.printingType || selectedOption.printingType || inputs.printing || '';
      setShowCoverPaper(false);
    }
    const cutSizeData = getCutSizeToSheetMapping(sheetSize);
    const normalizedSheetSize = normalizeSheetSize(sheetSize);
    const parsedSheet = parseCutSize(normalizedSheetSize);
    const paperLength = (cutSizeData === null || cutSizeData === void 0 ? void 0 : cutSizeData.paperLength) || toNumericValue(parsedSheet.length) || '';
    const paperWidth = (cutSizeData === null || cutSizeData === void 0 ? void 0 : cutSizeData.paperWidth) || toNumericValue(parsedSheet.width) || '';
    const qtyFullSheet = jobUps > 0 ? Math.ceil(totalSheets / jobUps) : totalSheets;
    let coverPaperData = {
      coverPaperLength: '',
      coverPaperWidth: '',
      coverCutSize: '',
      coverUps: '',
      coverQtyFullSheet: '',
      coverQtyCutSheet: '',
      coverPaperGsm: '',
      coverPaperType: '',
      coverPaperBy: 'us',
      coverPrintingColor: '',
    };
    if (bookletLayout && parseFloat(String(bookletLayout.coverGsm || '0')) > 0) {
      const resultInputs = bookletLayout;
      const paperSize = resultInputs.size || resultInputs.paperSize;
      const padCover = getPadBookCoverQuantitiesFromResult(selectedOption);
      if (isBookletsProductType(quotation === null || quotation === void 0 ? void 0 : quotation.productType) && padCover) {
        var _selectedOption$padBo, _selectedOption$padBo2, _coverCutMap, _coverCutMap2, _coverCutMap3;
        const cs = (selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$padBo = selectedOption.padBookCosts) === null || _selectedOption$padBo === void 0 ? void 0 : _selectedOption$padBo.coverSheet) || {};
        let coverCutSize = '';
        if (cs.cutW != null && cs.cutH != null) {
          coverCutSize = `${cs.cutW}x${cs.cutH}`.replace(/\s+/g, '');
        }
        let coverCutMap = coverCutSize ? getCutSizeToSheetMapping(coverCutSize) : null;
        if (!coverCutMap) {
          coverCutSize = getFitSheetSizeForBooklet(paperSize, resultInputs.coverPrintingColor);
          coverCutMap = getCutSizeToSheetMapping(coverCutSize);
        }
        const parentUps = Number(cs.parentUps) || 0;
        const upsFromPb = Number(selectedOption === null || selectedOption === void 0 ? void 0 : (_selectedOption$padBo2 = selectedOption.padBookCosts) === null || _selectedOption$padBo2 === void 0 ? void 0 : _selectedOption$padBo2.coverUps) || 1;
        const coverUpsField = parentUps > 0 ? parentUps : ((_coverCutMap = coverCutMap) === null || _coverCutMap === void 0 ? void 0 : _coverCutMap.ups) || upsFromPb;
        coverPaperData = {
          coverPaperLength: ((_coverCutMap2 = coverCutMap) === null || _coverCutMap2 === void 0 ? void 0 : _coverCutMap2.paperLength) || (cs.parentW != null ? String(cs.parentW) : ''),
          coverPaperWidth: ((_coverCutMap3 = coverCutMap) === null || _coverCutMap3 === void 0 ? void 0 : _coverCutMap3.paperWidth) || (cs.parentH != null ? String(cs.parentH) : ''),
          coverCutSize: coverCutSize || '',
          coverUps: coverUpsField,
          coverQtyCutSheet: padCover.totalCutSheets,
          coverQtyFullSheet: padCover.fullSheets,
          coverPaperGsm: resultInputs.coverGsm || '',
          coverPaperType: String(resultInputs.coverPaperType || '').trim() || '',
          coverPaperBy: 'us',
          coverPrintingColor: resolveCoverPrintingColorFromInputs(resultInputs),
        };
      } else {
        const bookletSelected = paperOptions.find(p => p.value === paperSize);
        const bookletUps = (bookletSelected === null || bookletSelected === void 0 ? void 0 : bookletSelected.ups) || 1;
        const qty = parseInt(resultInputs.qty || resultInputs.qty1 || 0, 10);
        const coverWastage = qty / 2 <= 2100 ? 100 : qty / 2 <= 4000 ? 150 : qty / 2 <= 5000 ? 200 : qty / 2 <= 9000 ? 250 : qty / 2 <= 15000 ? 350 : 500;
        const coverCutSize = getFitSheetSizeForBooklet(paperSize, resultInputs.coverPrintingColor);
        const coverCutMap = getCutSizeToSheetMapping(coverCutSize);
        const coverUps = (coverCutMap === null || coverCutMap === void 0 ? void 0 : coverCutMap.ups) || 1;
        const coverQtyCutSheet = Math.ceil(qty * 4 / bookletUps + coverWastage);
        const coverQtyFullSheet = Math.ceil(coverQtyCutSheet / coverUps);
        coverPaperData = {
          coverPaperLength: (coverCutMap === null || coverCutMap === void 0 ? void 0 : coverCutMap.paperLength) || '',
          coverPaperWidth: (coverCutMap === null || coverCutMap === void 0 ? void 0 : coverCutMap.paperWidth) || '',
          coverCutSize: coverCutSize || '',
          coverUps: coverUps,
          coverQtyCutSheet: coverQtyCutSheet,
          coverQtyFullSheet: coverQtyFullSheet,
          coverPaperGsm: resultInputs.coverGsm || '',
          coverPaperType: String(resultInputs.coverPaperType || '').trim() || '',
          coverPaperBy: 'us',
          coverPrintingColor: resolveCoverPrintingColorFromInputs(resultInputs),
        };
      }
      setShowCoverPaper(true);
    }
    const isEnvelopeQuotation = quotation.productType === 'Envelope';
    const envIntSource = selectedOption !== null && selectedOption !== void 0 && selectedOption.internalFabrications && selectedOption.internalFabrications.length > 0 ? selectedOption.internalFabrications : (selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.selectedInternalFabrications) || inputs.selectedInternalFabrications;
    let normalizedInternalFabs = normalizeFabSelection(envIntSource, internalFabrications);
    if (isEnvelopeQuotation && normalizedInternalFabs.length === 0) {
      normalizedInternalFabs = normalizeFabSelection((selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.internalFabrications) || inputs.selectedInternalFabrications, internalFabrications);
    }
    const envExtSource = pickExternalFabricationRowsFromQuotationOption(selectedOption, inputs);
    let normalizedExternalFabs = normalizeFabSelection(envExtSource, externalFabrications);
    const internalJointRows = pickQuotationJointRows(selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.ifabJointProducts, inputs.ifabJointProducts);
    const externalJointRows = pickQuotationJointRows(selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.efabJointProducts, inputs.efabJointProducts);
    const mergedJointRows = [...(Array.isArray(internalJointRows) ? internalJointRows : []), ...(Array.isArray(externalJointRows) ? externalJointRows : [])];
    if (mergedJointRows.length > 0 && normalizedExternalFabs.length === 0) {
      normalizedExternalFabs = [''];
    }
    let normalizedExternalFabJoints = normalizeFabJointSelectionMapped(mergedJointRows, normalizedExternalFabs.length);
    normalizedExternalFabJoints = resolveJointProductsMap(normalizedExternalFabJoints, normalizedExternalFabs, externalFabrications);
    const normalizedInternalFabJoints = {};
    const fabPatch = {
      pages: autofilledPages,
      size: autofilledSize,
      paperGsm: paperGsm,
      paperType: paperType,
      cutSize: sheetSize,
      ups: jobUps,
      qtyFullSheet: qtyFullSheet,
      qtyCutSheet: totalSheets,
      paperLength: paperLength,
      paperWidth: paperWidth,
      paperBy: paperBy,
      jobColor: jobColor,
      internalFabrications: normalizedInternalFabs,
      externalFabrications: normalizedExternalFabs,
      internalFabricationJointProducts: normalizedInternalFabJoints,
      externalFabricationJointProducts: normalizedExternalFabJoints,
      posterGumming: isEnvelopeQuotation ? !!(selectedOption !== null && selectedOption !== void 0 && selectedOption.hasGummingFlap) : !!((_selectedOption$poste = selectedOption.posterGumming) !== null && _selectedOption$poste !== void 0 ? _selectedOption$poste : inputs.posterGumming),
      gummingWidth: (_ref9 = (_selectedOption$gummi = selectedOption.gummingWidth) !== null && _selectedOption$gummi !== void 0 ? _selectedOption$gummi : inputs.gummingWidth) !== null && _ref9 !== void 0 ? _ref9 : '',
      gummingHeight: (_ref0 = (_selectedOption$gummi2 = selectedOption.gummingHeight) !== null && _selectedOption$gummi2 !== void 0 ? _selectedOption$gummi2 : inputs.gummingHeight) !== null && _ref0 !== void 0 ? _ref0 : '',
      noOfStrips: (_ref1 = (_selectedOption$noOfS = selectedOption.noOfStrips) !== null && _selectedOption$noOfS !== void 0 ? _selectedOption$noOfS : inputs.noOfStrips) !== null && _ref1 !== void 0 ? _ref1 : '',
      gummingStripType: (_ref10 = (_selectedOption$gummi3 = selectedOption.gummingStripType) !== null && _selectedOption$gummi3 !== void 0 ? _selectedOption$gummi3 : inputs.gummingStripType) !== null && _ref10 !== void 0 ? _ref10 : '',
      baseQty: inputs.qty || ((_quotation$inputs3 = quotation.inputs) === null || _quotation$inputs3 === void 0 ? void 0 : _quotation$inputs3.qty) || '',
      ...coverPaperData
    };
    setFormData(prev => {
      var _quotation$inputs4;
      const quotationBindingType = inputs.bindingType || ((_quotation$inputs4 = quotation.inputs) === null || _quotation$inputs4 === void 0 ? void 0 : _quotation$inputs4.bindingType) || prev.bindingProduct || '';
      const resolvedBind = resolveBindingProductFromQuotation(quotationBindingType);
      const patched = {
        ...prev,
        ...fabPatch,
        bindingProduct: isEnvelopeQuotation ? '' : resolvedBind,
        bindingProcesses: isEnvelopeQuotation ? [] : bindingProductProcessMap[resolvedBind] || []
      };
      setTimeout(() => autoSelectTasks(patched, autoFilledProcessRows), 0);
      return patched;
    });
  };
  const handleOptionSelect = e => {
    const optionIndex = e.target.value;
    setFormData(prev => ({
      ...prev,
      selectedOptionIndex: optionIndex
    }));
    if (optionIndex !== '' && selectedQuotation) {
      const selectedOption = quotationOptions.find(opt => {
        var _opt$__originalIndex;
        return String((_opt$__originalIndex = opt === null || opt === void 0 ? void 0 : opt.__originalIndex) !== null && _opt$__originalIndex !== void 0 ? _opt$__originalIndex : '') === String(optionIndex);
      });
      if (selectedOption) {
        // Auto-fill job card fields based on selected option
        autoFillFromSelectedOption(selectedOption, selectedQuotation, parseInt(optionIndex, 10));
      }
    }
  };
  const handleQuotationSelect = quotationOrEvent => {
    var _quotationOrEvent$tar;
    // Accept either a quotation object (from search picker) or a legacy select event
    const quotation = quotationOrEvent && typeof quotationOrEvent === 'object' && quotationOrEvent.serial !== undefined ? quotationOrEvent : null;
    const quotationSerial = quotation ? String(quotation.serial) : (quotationOrEvent === null || quotationOrEvent === void 0 ? void 0 : (_quotationOrEvent$tar = quotationOrEvent.target) === null || _quotationOrEvent$tar === void 0 ? void 0 : _quotationOrEvent$tar.value) || '';
    manualBookletAppliedKeyRef.current = '';
    setFormData(prev => ({
      ...prev,
      quotationNumber: quotationSerial,
      selectedOptionIndex: '',
      productName: ''
    }));
    if (quotationSerial) {
      if (quotation) {
        console.log('Selected Quotation:', quotation);
        const applyQuotationToJobCard = q => {
          if (!q || q.serial == null) return;
          setSelectedQuotation(q);
          setFormData(prev => ({
            ...prev,
            quotationDetails: q
          }));
          const inputs = q.inputs || {};
          const quotationResults = q.results || [];
          const usedIndexes = new Set((jobCards || []).filter(card => String((card === null || card === void 0 ? void 0 : card.quotationNumber) || '') === String(q.serial || '')).filter(card => !(editingJobCard && String(card === null || card === void 0 ? void 0 : card.id) === String(editingJobCard === null || editingJobCard === void 0 ? void 0 : editingJobCard.id))).map(card => {
            const idx = parseInt(card === null || card === void 0 ? void 0 : card.selectedOptionIndex, 10);
            return Number.isFinite(idx) ? idx : 0;
          }));
          const availableOptions = quotationResults.map((option, idx) => ({
            ...option,
            __originalIndex: idx
          })).filter(option => !usedIndexes.has(option.__originalIndex));
          setQuotationOptions(availableOptions);
          if (availableOptions.length > 0) {
            const firstOption = availableOptions[0];
            const firstOptionIndex = Number.isFinite(parseInt(firstOption === null || firstOption === void 0 ? void 0 : firstOption.__originalIndex, 10)) ? parseInt(firstOption.__originalIndex, 10) : 0;
            setFormData(prev => ({
              ...prev,
              customerName: q.customerName || '',
              productName: q.productType || '',
              selectedOptionIndex: String(firstOptionIndex),
              bindingProduct: (() => {
                const quotationBindingType = inputs.bindingType || prev.bindingProduct || '';
                return resolveBindingProductFromQuotation(quotationBindingType);
              })(),
              bindingProcesses: (() => {
                const quotationBindingType = inputs.bindingType || prev.bindingProduct || '';
                const resolved = resolveBindingProductFromQuotation(quotationBindingType);
                return bindingProductProcessMap[resolved] || [];
              })()
            }));
            setTimeout(() => {
              autoFillFromSelectedOption(firstOption, q, firstOptionIndex);
            }, 0);
          } else {
            setFormData(prev => ({
              ...prev,
              customerName: q.customerName || '',
              productName: q.productType || '',
              bindingProduct: (() => {
                const quotationBindingType = inputs.bindingType || prev.bindingProduct || '';
                return resolveBindingProductFromQuotation(quotationBindingType);
              })(),
              bindingProcesses: (() => {
                const quotationBindingType = inputs.bindingType || prev.bindingProduct || '';
                const resolved = resolveBindingProductFromQuotation(quotationBindingType);
                return bindingProductProcessMap[resolved] || [];
              })()
            }));
          }
        };

        // Same full payload as "Get Task Amount" so `results` always includes joint rows etc.
        makeAuthenticatedRequest(`/api/quotations/${quotation.serial}`).then(async res => {
          if (!res.ok) throw new Error('quotation fetch failed');
          const payload = await res.json();
          const full = payload === null || payload === void 0 ? void 0 : payload.data;
          applyQuotationToJobCard(full && full.serial != null ? full : quotation);
        }).catch(() => applyQuotationToJobCard(quotation));
      }
    } else {
      setSelectedQuotation(null);
      setQuotationOptions([]);
      setProcessRows([{
        forms: '',
        sideCount: '',
        qty: '',
        extraSheets: '',
        plates: '',
        type: '',
        machine: '',
        lamination: ''
      }]);
      setProcessDetailsAutoFilled(false);
      setShowCoverPaper(false);
    }
  };
  const searchQuotations = useCallback(text => {
    if (quotationSearchDebounce.current) clearTimeout(quotationSearchDebounce.current);
    if (!text || !text.trim()) {
      setQuotationSearchResults([]);
      setQuotationSearchLoading(false);
      return;
    }
    setQuotationSearchLoading(true);
    quotationSearchDebounce.current = setTimeout(() => {
      // Keep used quotations visible in search so multi-option quotations
      // (Option 1 / Option 2 / ...) can be reused for another job card.
      const includeUsed = 'true';
      makeAuthenticatedRequest(`/api/quotations?search=${encodeURIComponent(text.trim())}&limit=15&includeUsed=${includeUsed}`).then(res => res.json()).then(data => {
        setQuotationSearchResults(Array.isArray(data === null || data === void 0 ? void 0 : data.data) ? data.data : []);
        setQuotationSearchLoading(false);
        setQuotationSearchOpen(true);
      }).catch(() => {
        setQuotationSearchResults([]);
        setQuotationSearchLoading(false);
      });
    }, 300);
  }, [editingJobCard]);
  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.customerName || !formData.productName || !formData.jobName) {
      alert('Please fill in all required fields (Customer, Product Name, Job Name)');
      return;
    }

    // Check if any process row has empty machine field
    const emptyMachines = processRows.some(row => !row.machine);
    if (emptyMachines) {
      alert('Please select machine for all process rows');
      return;
    }
    if (hasVarnishInProcessRows && !String(formData.varnishTaskMode || '').trim()) {
      alert('Please select Varnish handling: Printing or External.');
      return;
    }
    const paperQtyError = validateJobCardPaperQtyBeforeSave(formData, showCoverPaper);
    if (paperQtyError) {
      alert(paperQtyError);
      return;
    }
    try {
      const loginName = ((user === null || user === void 0 ? void 0 : user.username) || (user === null || user === void 0 ? void 0 : user.name) || '').trim();
      const savePriority = formData.priority === 'most_urgent' || formData.priority === 'urgent'
        ? 'most_urgent'
        : 'regular';
      const dispatchDateIso =
        parseDispatchDateInputToIso(dispatchDateDisplay)
        || String(formData.dispatchDate || '').trim();
      const jobCardData = {
        ...formData,
        dispatchDate: dispatchDateIso,
        priority: savePriority,
        createdBy: String(formData.createdBy || '').trim() || loginName,
        imageData: uploadedImageData || formData.imageData || '',
        processDetails: processRows,
        taskManager: {
          ...taskManager,
          varnishTaskMode: formData.varnishTaskMode || '',
          customOrder: taskOrder
        },
        quotationDetails: selectedQuotation ? JSON.stringify({
          ...selectedQuotation,
          selectedOptionIndex: formData.selectedOptionIndex !== '' ? parseInt(formData.selectedOptionIndex, 10) : 0
        }) : null,
        quotationDetailsTable: selectedQuotation !== null && selectedQuotation !== void 0 && selectedQuotation.quotationDetailsTable ? JSON.stringify(selectedQuotation.quotationDetailsTable) : null
      };
      const isEditing = Boolean(editingJobCard && editingJobCard.id);
      const url = isEditing ? `/api/jobcards/${editingJobCard.id}` : `/api/jobcards`;
      const method = isEditing ? 'PUT' : 'POST';
      const response = await makeAuthenticatedRequest(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobCardData)
      });
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        alert('Server returned invalid response. Check console for details.');
        return;
      }
      if (response.ok) {
        if (isEditing) {
          alert('Job Card updated successfully!');
        } else {
          var _data$data2;
          alert(`Job Card created successfully! Job Card Number: ${((_data$data2 = data.data) === null || _data$data2 === void 0 ? void 0 : _data$data2.jobCardNum) || data.jobCardNum}`);
        }

        // Clear search after save so the used quotation won't be re-suggested
        if (formData.quotationNumber) {
          setQuotationSearch('');
          setQuotationSearchResults([]);
        }
        setFormData({
          customerName: '',
          quotationNumber: '',
          productName: '',
          jobName: '',
          jobCardNum: '',
          pages: '',
          size: '— Custom —',
          poNumber: '',
          imageAttached: '',
          imageData: '',
          billingType: 'billing',
          sampleAttached: 'no',
          paperLength: '',
          paperWidth: '',
          cutSize: '',
          ups: '',
          qtyFullSheet: '',
          qtyCutSheet: '',
          paperGsm: '',
          paperType: '',
          paperBy: 'us',
          jobColor: '',
          plateBy: 'us',
          jobType: 'new',
          priority: 'regular',
          repeatNo: '',
          requestPlate: 'pc2plate',
          coverPaperLength: '',
          coverPaperWidth: '',
          coverCutSize: '',
          coverUps: '',
          coverQtyFullSheet: '',
          coverQtyCutSheet: '',
          coverPaperGsm: '',
          coverPaperType: '',
          coverPaperBy: 'us',
          coverPrintingColor: '',
          bindingProduct: '',
          bindingProcesses: [],
          internalFabrications: [],
          externalFabrications: [],
          internalFabricationJointProducts: {},
          externalFabricationJointProducts: {},
          posterGumming: false,
          gummingWidth: '',
          gummingHeight: '',
          noOfStrips: '',
          gummingStripType: '',
          dispatchDate: '',
          baseQty: '',
          remark: '',
          varnishTaskMode: '',
          createdBy: ''
        });
        setUploadedImageData('');
        fetchNextJobCardNumber();
        setShowCoverPaper(false);
        setSelectedQuotation(null);
        setProcessRows([{
          forms: '',
          sideCount: '',
          qty: '',
          extraSheets: '',
          plates: '',
          type: '',
          machine: '',
          lamination: ''
        }]);
        setEditingJobCard(null);
        setShowList(true);
        setRefreshTrigger(Date.now());
      } else {
        alert(`Error creating job card: ${data.error || data.message || 'Unknown server error'}`);
      }
    } catch (error) {
      alert(`Error creating job card: ${error.message}`);
    }
  };
  const handleGetTaskAmount = async () => {
    if (!formData.quotationNumber) {
      autoSelectTasks();
      return;
    }
    try {
      setIsRefreshingTaskData(true);
      const response = await makeAuthenticatedRequest(`/api/quotations/${formData.quotationNumber}`);
      const data = await response.json();
      const latestQuotation = data === null || data === void 0 ? void 0 : data.data;
      if (latestQuotation && Array.isArray(latestQuotation.results) && latestQuotation.results.length > 0) {
        setSelectedQuotation(latestQuotation);
        const usedIndexes = new Set((jobCards || []).filter(card => String((card === null || card === void 0 ? void 0 : card.quotationNumber) || '') === String(latestQuotation.serial || '')).filter(card => !(editingJobCard && String(card === null || card === void 0 ? void 0 : card.id) === String(editingJobCard === null || editingJobCard === void 0 ? void 0 : editingJobCard.id))).map(card => {
          const idx = parseInt(card === null || card === void 0 ? void 0 : card.selectedOptionIndex, 10);
          return Number.isFinite(idx) ? idx : 0;
        }));
        const availableOptions = latestQuotation.results.map((option, idx) => ({
          ...option,
          __originalIndex: idx
        })).filter(option => !usedIndexes.has(option.__originalIndex));
        setQuotationOptions(availableOptions);
        setFormData(prev => ({
          ...prev,
          quotationDetails: latestQuotation
        }));
        const selectedIdx = formData.selectedOptionIndex !== '' ? parseInt(formData.selectedOptionIndex, 10) : NaN;
        const defaultIdx = availableOptions.length > 0 ? Number(availableOptions[0].__originalIndex) : 0;
        const safeIdx = Number.isNaN(selectedIdx) ? defaultIdx : selectedIdx;
        autoSelectTasks({
          ...formData,
          quotationDetails: latestQuotation
        });
      } else {
        autoSelectTasks();
      }
    } catch (error) {
      autoSelectTasks();
    } finally {
      setIsRefreshingTaskData(false);
    }
  };
  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all data?")) {
      setFormData({
        customerName: '',
        quotationNumber: '',
        productName: '',
        selectedOptionIndex: '',
        jobName: '',
        jobCardNum: '',
        pages: '',
        size: '— Custom —',
        poNumber: '',
        imageAttached: '',
        billingType: 'billing',
        sampleAttached: 'no',
        paperLength: '',
        paperWidth: '',
        cutSize: '',
        ups: '',
        qtyFullSheet: '',
        qtyCutSheet: '',
        paperGsm: '',
        paperType: '',
        paperBy: 'us',
        jobColor: '',
        plateBy: 'us',
        jobType: 'new',
        priority: 'regular',
        repeatNo: '',
        requestPlate: 'pc2plate',
        coverPaperLength: '',
        coverPaperWidth: '',
        coverCutSize: '',
        coverUps: '',
        coverQtyFullSheet: '',
        coverQtyCutSheet: '',
        coverPaperGsm: '',
        coverPaperType: '',
        coverPaperBy: 'us',
        coverPrintingColor: '',
        bindingProduct: '',
        bindingProcesses: [],
        internalFabrications: [],
        externalFabrications: [],
        internalFabricationJointProducts: {},
        externalFabricationJointProducts: {},
        posterGumming: false,
        gummingWidth: '',
        gummingHeight: '',
        noOfStrips: '',
        gummingStripType: '',
        dispatchDate: '',
        baseQty: '',
        remark: '',
        varnishTaskMode: '',
        createdBy: ''
      });
      setProcessRows([{
        forms: '',
        sideCount: '',
        qty: '',
        extraSheets: '',
        plates: '',
        type: '',
        machine: '',
        lamination: ''
      }]);
      setTaskManager({
        cutting: {
          selected: false,
          machine: '',
          amount: '',
          quotationAmount: '',
          amountSource: 'quotationAmount',
          instructions: '',
          user: '',
          wastageAmount: ''
        },
        printing: {
          selected: false,
          machine: '',
          amount: '',
          quotationAmount: '',
          amountSource: 'quotationAmount',
          instructions: '',
          user: '',
          wastageAmount: ''
        },
        lamination: {
          selected: false,
          machine: '',
          amount: '',
          quotationAmount: '',
          amountSource: 'quotationAmount',
          instructions: '',
          user: '',
          wastageAmount: ''
        },
        binding: {
          selected: false,
          machine: '',
          amount: '',
          quotationAmount: '',
          amountSource: 'quotationAmount',
          instructions: '',
          user: '',
          wastageAmount: ''
        },
        billing: {
          selected: true,
          machine: 'INTERNAL',
          amount: '',
          quotationAmount: '',
          amountSource: 'quotationAmount',
          instructions: '',
          user: '',
          wastageAmount: ''
        }
      });
      setTaskOrder([]);
      setSelectedQuotation(null);
      setQuotationOptions([]);
      setBookletDataLoaded(false);
      setProcessDetailsAutoFilled(false);
    }
  };

  return (
    <div className="form-container-modern job-card-bloom">
      <div className="job-card-bloom__tabs">
        <button
          type="button"
          onClick={() => setShowList(false)}
          className={`job-card-bloom__tab ${!showList ? 'job-card-bloom__tab--active' : ''}`}
          disabled={!showList}
        >
          Add Job Card
        </button>
        <button
          type="button"
          onClick={() => {
            setShowList(true);
            if (typeof window !== 'undefined') window.scrollTo(0, 0);
          }}
          className={`job-card-bloom__tab ${showList ? 'job-card-bloom__tab--active' : ''}`}
          disabled={showList}
        >
          Edit Job Card
        </button>
      </div>

      {!showList ? (
        <header className="job-card-bloom__header">
          <h1 className="job-card-bloom__greeting">
            {editingJobCard ? 'Edit job card' : 'Create a job card'}
          </h1>
        </header>
      ) : null}

      {showList ? (
        <div>
          <JobCardList
            refreshTrigger={refreshTrigger}
            onEdit={handleEdit}
            laminationTypes={laminationTypes}
            internalFabrications={internalFabrications}
            externalFabrications={externalFabrications}
            printingMachines={printingMachines}
          />
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {bookletDataLoaded && (
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#10B981', 
                  color: 'white', 
                  borderRadius: '6px', 
                  fontSize: '0.85rem',
                  animation: 'fadeIn 0.3s ease-in'
                }}>
                  ✓ Booklet Process Details Loaded
                </div>
              )}
              {processDetailsAutoFilled && (
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#3B82F6', 
                  color: 'white', 
                  borderRadius: '6px', 
                  fontSize: '0.85rem',
                  animation: 'fadeIn 0.3s ease-in'
                }}>
                  ✓ Process Details Auto-Filled from Quotation
                </div>
              )}
            </div>
         </div>
       
         <form onSubmit={handleSubmit} className="form-modern job-card-form">
        <div className="job-card-section">
          <h3 className="section-title">Customer & Product Details</h3>
          <div className="job-card-details-row-1">
            <div className="form-group-modern">
              <label className="form-label-modern">Customer *</label>
              <BloomSelect
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                className="input-field-modern"
                required
              >
                <option value="">Select Customer</option>
                {customers.sort((a, b) => (a.customerName || a.name || '').localeCompare(b.customerName || b.name || '')).map((customer) => (
                  <option key={customer.id} value={customer.customerName || customer.name}>
                    {customer.customerName || customer.name}
                  </option>
                ))}
              </BloomSelect>
            </div>

            <div className="form-group-modern" style={{ position: 'relative' }} ref={quotationSearchRef}>
              <label className="form-label-modern" title="Type quotation no. or customer name to search">
                Quotation (Auto-fill)
              </label>
              {formData.quotationNumber ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="jc-quotation-search__selected" style={{ flex: 1, padding: '8px 12px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', border: '1px solid #bae6fd', fontSize: '0.9rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ✓ #{formData.quotationNumber}{selectedQuotation ? ` — ${selectedQuotation.productType === 'CutToSheet' ? 'Cut to Sheet' : selectedQuotation.productType}` : ''}
                  </div>
                  <button
                    type="button"
                    className="jc-quotation-search__clear-selected"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        quotationNumber: '',
                        selectedOptionIndex: '',
                        productName: ''
                      }));
                      setSelectedQuotation(null);
                      setQuotationOptions([]);
                      setQuotationSearch('');
                      setQuotationSearchResults([]);
                      setQuotationSearchOpen(false);
                    }}
                    style={{ padding: '8px 12px', border: '1px solid #ef4444', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                    title="Clear selected quotation"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div className="jc-quotation-search__input-wrap" style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="input-field-modern"
                      placeholder="Search by quotation no. or customer name…"
                      value={quotationSearch}
                      onChange={e => {
                        const v = e.target.value;
                        setQuotationSearch(v);
                        searchQuotations(v);
                        if (!v) setQuotationSearchOpen(false);
                      }}
                      onFocus={() => {
                        if (quotationSearchResults.length > 0) setQuotationSearchOpen(true);
                      }}
                      autoComplete="off"
                      style={{ paddingRight: '2.5rem', width: '100%' }}
                    />
                    {quotationSearchLoading && (
                      <span className="jc-quotation-search__input-icon" aria-hidden="true" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                        ⏳
                      </span>
                    )}
                    {!quotationSearchLoading && quotationSearch && (
                      <button
                        type="button"
                        className="jc-quotation-search__input-clear"
                        onClick={() => {
                          setQuotationSearch('');
                          setQuotationSearchResults([]);
                          setQuotationSearchOpen(false);
                        }}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}
                        title="Clear search"
                        aria-label="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {quotationSearchOpen && quotationSearchResults.length > 0 && (
                    <div className="jc-quotation-search__dropdown" role="listbox" aria-label="Quotation search results" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', marginTop: '4px', maxH: '250px', overflowY: 'auto' }}>
                      {quotationSearchResults.map(q => (
                        <button
                          key={q.id || q.serial}
                          type="button"
                          className="jc-quotation-search__option"
                          role="option"
                          aria-selected={formData.quotationNumber === String(q.serial)}
                          onClick={() => {
                            handleQuotationSelect(q);
                            setQuotationSearch(`#${q.serial}`);
                            setQuotationSearchOpen(false);
                          }}
                          style={{ width: '100%', padding: '10px 12px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '8px', fontSize: '0.875rem' }}
                        >
                          <span className="jc-quotation-search__serial" style={{ fontWeight: '600', color: '#1e40af' }}>#{q.serial}</span>
                          <span className="jc-quotation-search__customer" style={{ color: '#374151', flex: 1 }}>{q.customerName || '—'}</span>
                          <span className="jc-quotation-search__product" style={{ color: '#6b7280', fontSize: '0.75rem', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{q.productType === 'CutToSheet' ? 'Cut to Sheet' : q.productType}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {quotationSearchOpen && !quotationSearchLoading && quotationSearch && quotationSearchResults.length === 0 && (
                    <div className="jc-quotation-search__empty" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                      No quotations found for "{quotationSearch}"
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">{selectedQuotation ? 'Option Number *' : 'Product Name *'}</label>
              <BloomSelect
                name={selectedQuotation ? "selectedOptionIndex" : "productName"}
                value={selectedQuotation ? formData.selectedOptionIndex : formData.productName}
                onChange={selectedQuotation ? handleOptionSelect : handleInputChange}
                className="input-field-modern"
                required
              >
                {selectedQuotation ? (
                  <>
                    <option value="">Select Option</option>
                    {quotationOptions.map((option, index) => (
                      <option key={index} value={index}>
                        Option {index + 1} - Qty: {option.qty || 'N/A'} - Amount: ₹{option.finalAmount || 'N/A'}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="">Select Product</option>
                    {productOptions.map((prod) => (
                      <option key={prod} value={prod}>{prod}</option>
                    ))}
                  </>
                )}
              </BloomSelect>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Job Name *</label>
              <input
                type="text"
                name="jobName"
                value={formData.jobName}
                onChange={handleInputChange}
                className="input-field-modern"
                required
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Standard Size</label>
              <div className="job-card-size-dimensions">
                <input
                  type="number"
                  value={jobSizeDimensions.w}
                  onChange={(e) => handleSizeDimensionChange('width', e.target.value)}
                  className="input-field-modern job-card-size-dimensions__input"
                  placeholder="Width"
                  step="0.01"
                  min="0"
                />
                <span className="job-card-size-dimensions__sep" aria-hidden="true">×</span>
                <input
                  type="number"
                  value={jobSizeDimensions.h}
                  onChange={(e) => handleSizeDimensionChange('height', e.target.value)}
                  className="input-field-modern job-card-size-dimensions__input"
                  placeholder="Height"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">No. of Pages</label>
              <input
                type="text"
                name="pages"
                value={formData.pages || ''}
                onChange={handleInputChange}
                placeholder="e.g. 40+4 (inner+cover)"
                className="input-field-modern"
                inputMode="numeric"
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Base Qty</label>
              <input
                type="number"
                name="baseQty"
                value={formData.baseQty}
                onChange={handleInputChange}
                placeholder="e.g. 500"
                className="input-field-modern"
              />
            </div>
          </div>

          <div className="job-card-details-row-2">
            <div className="form-group-modern">
              <label className="form-label-modern">Created by</label>
              <input
                type="text"
                name="createdBy"
                value={formData.createdBy || ((user === null || user === void 0 ? void 0 : user.username) || (user === null || user === void 0 ? void 0 : user.name) || 'admin')}
                className="input-field-modern"
                disabled
              />
              <span style={{ fontSize: '0.7rem', color: '#888888', marginTop: '-4px', display: 'block' }}>
                Saved as your login when you submit
              </span>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">PO Number</label>
              <input
                type="text"
                name="poNumber"
                value={formData.poNumber}
                onChange={handleInputChange}
                className="input-field-modern"
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Image Attached</label>
              <input
                type="file"
                name="imageAttached"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    
                    img.onload = () => {
                      const maxWidth = 800;
                      const maxHeight = 600;
                      let { width, height } = img;
                      
                      if (width > height) {
                        if (width > maxWidth) {
                          height = (height * maxWidth) / width;
                          width = maxWidth;
                        }
                      } else {
                        if (height > maxHeight) {
                          width = (width * maxHeight) / height;
                          height = maxHeight;
                        }
                      }
                      
                      canvas.width = width;
                      canvas.height = height;
                      ctx.drawImage(img, 0, 0, width, height);
                      
                      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                      setFormData(prev => ({
                        ...prev, 
                        imageAttached: file.name,
                        imageData: compressedDataUrl
                      }));
                    };
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                  } else {
                    setFormData(prev => ({...prev, imageAttached: '', imageData: ''}));
                  }
                }}
                className="input-field-modern"
                accept="image/*"
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Billing Type *</label>
              <BloomSelect
                name="billingType"
                value={formData.billingType}
                onChange={handleInputChange}
                className="input-field-modern"
                required
              >
                {billingOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </BloomSelect>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Priority *</label>
              <BloomSelect
                name="priority"
                value={formData.priority === 'most_urgent' || formData.priority === 'urgent' ? 'most_urgent' : 'regular'}
                onChange={handleInputChange}
                className="input-field-modern"
                required
              >
                <option value="most_urgent">Most Urgent</option>
                <option value="regular">Regular</option>
              </BloomSelect>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Sample Attached *</label>
              <BloomSelect
                name="sampleAttached"
                value={formData.sampleAttached}
                onChange={handleInputChange}
                className="input-field-modern"
                required
              >
                {sampleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </BloomSelect>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Dispatch Date</label>
              <input
                type="text"
                name="dispatchDate"
                value={dispatchDateDisplay}
                onChange={handleDispatchDateChange}
                onBlur={handleDispatchDateBlur}
                className="input-field-modern"
                placeholder="DD/MM/YYYY"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Job Card Number</label>
              <input
                type="text"
                name="jobCardNum"
                value={formData.jobCardNum || 'Auto'}
                className="input-field-modern"
                disabled
              />
            </div>
          </div>
        </div>



        <div className="job-card-section job-card-paper-print-process">
          <div className="job-card-subsection">
          <div className="job-card-section-toolbar">
            <h3 className="job-card-subsection-title">Main Paper Details</h3>
            <button 
              type="button" 
              onClick={() => setShowCoverPaper(!showCoverPaper)}
              className="save-btn-modern job-card-outline-btn"
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              {showCoverPaper ? 'Hide Cover Paper' : 'Cover Paper Details'}
            </button>
          </div>
          
          <div className="form-grid-modern">
            <div className="form-group-modern">
              <label className="form-label-modern">Paper Full Size (L×W)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  name="paperLength"
                  value={formData.paperLength}
                  onChange={handleInputChange}
                  className="input-field-modern"
                  placeholder="Length"
                  step="0.01"
                  style={{ flex: '1' }}
                />
                <span style={{ fontWeight: 'bold' }}>×</span>
                <input
                  type="number"
                  name="paperWidth"
                  value={formData.paperWidth}
                  onChange={handleInputChange}
                  className="input-field-modern"
                  placeholder="Width"
                  step="0.01"
                  style={{ flex: '1' }}
                />
              </div>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Cut Size</label>
              <input
                type="text"
                name="cutSize"
                value={formData.cutSize}
                onChange={handleInputChange}
                className="input-field-modern"
                placeholder="e.g. 18x23"
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">UPS</label>
              <BloomSelect
                name="ups"
                value={formData.ups}
                onChange={handleInputChange}
                className="input-field-modern"
              >
                <option value="">Select UPS</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
              </BloomSelect>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">GSM + Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  name="paperGsm"
                  value={formData.paperGsm}
                  onChange={handleInputChange}
                  className="input-field-modern"
                  placeholder="GSM"
                  style={{ flex: '1' }}
                />
                <BloomSelect
                  name="paperType"
                  value={formData.paperType}
                  onChange={handleInputChange}
                  className="input-field-modern"
                  style={{ flex: '2' }}
                >
                  <option value="">Select Paper Type</option>
                  {paperTypes && paperTypes.map((paperType) => (
                    <option key={paperType.id} value={paperType.paperTypeName}>
                      {paperType.paperTypeName}
                    </option>
                  ))}
                </BloomSelect>
              </div>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">
                Sheet Qty (Full Sheet){innerPaperFullSizeStarted ? ' *' : ''}
              </label>
              <input
                type="number"
                name="qtyFullSheet"
                value={formData.qtyFullSheet}
                onChange={handleInputChange}
                className="input-field-modern"
                placeholder="Enter quantity"
                min={innerPaperFullSizeStarted ? '1' : undefined}
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Qty Cut Sheet</label>
              <input
                type="number"
                name="qtyCutSheet"
                value={formData.qtyCutSheet}
                onChange={handleInputChange}
                className="input-field-modern"
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Paper By</label>
              <BloomSelect
                name="paperBy"
                value={formData.paperBy}
                onChange={handleInputChange}
                className="input-field-modern"
                required
              >
                <option value="us">Us</option>
                <option value="party">Party</option>
              </BloomSelect>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Job Color</label>
              <BloomSelect
                name="jobColor"
                value={formData.jobColor}
                onChange={handleInputChange}
                className="input-field-modern"
              >
                {JOB_CARD_COLOR_OPTIONS.map((opt) => (
                  <option key={`inner-color-${opt.value || 'empty'}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </BloomSelect>
            </div>
          </div>
          

          
          {showCoverPaper && (
            <div className="job-card-cover-paper">
              <h4 className="job-card-subsection-title job-card-cover-paper__title">Cover Paper Details</h4>
              <div className="form-grid-modern">
                <div className="form-group-modern">
                  <label className="form-label-modern">Cover Paper Full Size (L×W)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      name="coverPaperLength"
                      value={formData.coverPaperLength}
                      onChange={handleInputChange}
                      className="input-field-modern"
                      placeholder="Length"
                      step="0.01"
                      style={{ flex: '1' }}
                    />
                    <span style={{ fontWeight: 'bold' }}>×</span>
                    <input
                      type="number"
                      name="coverPaperWidth"
                      value={formData.coverPaperWidth}
                      onChange={handleInputChange}
                      className="input-field-modern"
                      placeholder="Width"
                      step="0.01"
                      style={{ flex: '1' }}
                    />
                  </div>
                </div>

                <div className="form-group-modern">
                  <label className="form-label-modern">Cover Cut Size</label>
                  <input
                    type="text"
                    name="coverCutSize"
                    value={formData.coverCutSize}
                    onChange={handleInputChange}
                    className="input-field-modern"
                    placeholder="e.g. 18x23"
                  />
                </div>

                <div className="form-group-modern">
                  <label className="form-label-modern">Cover UPS</label>
                  <BloomSelect
                    name="coverUps"
                    value={formData.coverUps}
                    onChange={handleInputChange}
                    className="input-field-modern"
                  >
                    <option value="">Select UPS</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </BloomSelect>
                </div>

                <div className="form-group-modern">
                  <label className="form-label-modern">Cover GSM + Type</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      name="coverPaperGsm"
                      value={formData.coverPaperGsm}
                      onChange={handleInputChange}
                      className="input-field-modern"
                      placeholder="GSM"
                      style={{ flex: '1' }}
                    />
                    <BloomSelect
                      name="coverPaperType"
                      value={formData.coverPaperType}
                      onChange={handleInputChange}
                      className="input-field-modern"
                      style={{ flex: '2' }}
                    >
                      <option value="">Select Paper Type</option>
                      {paperTypes && paperTypes.map((paperType) => (
                        <option key={paperType.id} value={paperType.paperTypeName}>
                          {paperType.paperTypeName}
                        </option>
                      ))}
                    </BloomSelect>
                  </div>
                </div>

                <div className="form-group-modern">
                  <label className="form-label-modern">
                    Cover Sheet Qty (Full Sheet){coverPaperFullSizeStarted ? ' *' : ''}
                  </label>
                  <input
                    type="number"
                    name="coverQtyFullSheet"
                    value={formData.coverQtyFullSheet}
                    onChange={handleInputChange}
                    className="input-field-modern"
                    placeholder="Enter quantity"
                    min={coverPaperFullSizeStarted ? '1' : undefined}
                  />
                </div>

                <div className="form-group-modern">
                  <label className="form-label-modern">Cover Qty Cut Sheet</label>
                  <input
                    type="number"
                    name="coverQtyCutSheet"
                    value={formData.coverQtyCutSheet}
                    onChange={handleInputChange}
                    className="input-field-modern"
                  />
                </div>

                <div className="form-group-modern">
                  <label className="form-label-modern">Cover Paper By *</label>
                  <BloomSelect
                    name="coverPaperBy"
                    value={formData.coverPaperBy}
                    onChange={handleInputChange}
                    className="input-field-modern"
                    required
                  >
                    <option value="us">Us</option>
                    <option value="party">Party</option>
                  </BloomSelect>
                </div>

                <div className="form-group-modern">
                  <label className="form-label-modern">Job Color</label>
                  <BloomSelect
                    name="coverPrintingColor"
                    value={formData.coverPrintingColor}
                    onChange={handleInputChange}
                    className="input-field-modern"
                  >
                    {JOB_CARD_COLOR_OPTIONS.map((opt) => (
                      <option key={`cover-color-${opt.value || 'empty'}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </BloomSelect>
                </div>
              </div>
            </div>
          )}
          </div>

          <div className="job-card-subsection">
          <h3 className="job-card-subsection-title">Printing Details</h3>
          <div className="form-grid-modern">

          <div className="form-group-modern">
            <label className="form-label-modern">Plate By *</label>
            <BloomSelect
              name="plateBy"
              value={formData.plateBy}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="us">Us</option>
              <option value="party">Party</option>
            </BloomSelect>
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Job Type *</label>
            <BloomSelect
              name="jobType"
              value={formData.jobType}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              {jobOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </BloomSelect>
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Repeat No</label>
            <input
              type="text"
              name="repeatNo"
              value={formData.repeatNo}
              onChange={handleInputChange}
              className="input-field-modern"
            />
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Request Plate *</label>
            <BloomSelect
              name="requestPlate"
              value={formData.requestPlate}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="pc2plate">PC2Plate</option>
              <option value="NA">NA</option>
            </BloomSelect>
          </div>
          </div>
          </div>

          <div className="job-card-subsection">
          <div className="job-card-section-toolbar">
            <h3 className="job-card-subsection-title">
              Process Details 
              {formData.quotationNumber && (
                <span style={{ fontSize: '0.85rem', color: '#6B7280', fontWeight: 'normal' }}>
                  (Auto-filled from {selectedQuotation?.productType || 'Quotation'} #{formData.quotationNumber})
                </span>
              )}
            </h3>
            <button
              type="button"
              onClick={addProcessRow}
              className="save-btn-modern job-card-outline-btn"
              style={{ fontSize: '18px', padding: '8px 16px' }}
              tabIndex={-1}
              title="Add process row (F3)"
              aria-label="Add process row (F3)"
            >
              +
            </button>
          </div>
          
          {processRows.map((row, index) => (
            <div key={index} className="process-row-12">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                {processRows.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeProcessRow(index)}
                    className="save-btn-modern" 
                    style={{ backgroundColor: '#ff6b6b', borderColor: '#ff6b6b', fontSize: '14px', padding: '4px 8px' }}
                  >
                    -
                  </button>
                )}
              </div>
              <div className="process-grid-12">
                <div className="form-group-modern">
                  <label className="form-label-modern">Remark</label>
                  <input
                    type="text"
                    value={row.remark || ''}
                    onChange={(e) => updateProcessRow(index, 'remark', e.target.value)}
                    className="input-field-modern"
                    placeholder="Remark"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Forms</label>
                  <BloomSelect
                    value={row.forms}
                    onChange={(e) => updateProcessRow(index, 'forms', e.target.value)}
                    className="input-field-modern"
                  >
                    <option value="">Select Form</option>
                    <option value="frontback">FrontBack</option>
                    <option value="selfback">Selfback</option>
                    <option value="oneside">One Side</option>
                    <option value="double_gripper">Double Gripper</option>
                  </BloomSelect>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Form count</label>
                  <input
                    type="number"
                    value={row.sideCount}
                    onChange={(e) => updateProcessRow(index, 'sideCount', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Qty</label>
                  <input
                    type="number"
                    value={row.qty}
                    onChange={(e) => updateProcessRow(index, 'qty', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Extra Sheets</label>
                  <input
                    type="number"
                    value={row.extraSheets}
                    onChange={(e) => updateProcessRow(index, 'extraSheets', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Machine *</label>
                  <BloomSelect
                    value={row.machine}
                    onChange={(e) => updateProcessRow(index, 'machine', e.target.value)}
                    className="input-field-modern"
                    required
                    title={(() => {
                      const jobColor = formData.jobColor?.toLowerCase() || '';
                      if (jobColor.includes('single') || jobColor.includes('1+0') || jobColor.includes('1+1') || 
                          jobColor.includes('2+0') || jobColor.includes('2+2')) {
                        return 'Single color jobs must use Heidelberg';
                      }
                      return 'Select machine';
                    })()}
                  >
                    <option value="">Select Machine</option>
                    {processMachineSelectOptions.map((machineName) => (
                      <option key={machineName} value={machineName}>{machineName}</option>
                    ))}
                  </BloomSelect>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Lamination</label>
                  <BloomSelect
                    value={row.lamination}
                    onChange={(e) => updateProcessRow(index, 'lamination', e.target.value)}
                    className="input-field-modern"
                  >
                    <option value="">Select Lamination Type</option>
                    <option value="Matt Lamination B/S">Matt Lamination B/S</option>
                    <option value="Matt Lamination O/S">Matt Lamination O/S</option>
                    <option value="Gloss Lamination B/S">Gloss Lamination B/S</option>
                    <option value="Gloss Lamination O/S">Gloss Lamination O/S</option>
                    <option value="Velvet Lamination B/S">Velvet Lamination B/S</option>
                    <option value="Velvet Lamination O/S">Velvet Lamination O/S</option>
                    <option value="Thermal Lamination B/S">Thermal Lamination B/S</option>
                    <option value="Thermal Lamination O/S">Thermal Lamination O/S</option>
                    <option value="Aqua Varsnish B/S">Aqua Varsnish B/S</option>
                    <option value="Aqua Varnsih O/S">Aqua Varnsih O/S</option>
                  </BloomSelect>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Inner / Cover</label>
                  <BloomSelect
                    value={processRowTypeToSelectValue(row.type)}
                    onChange={(e) => updateProcessRow(index, 'type', e.target.value)}
                    className="input-field-modern"
                  >
                    <option value="">Select</option>
                    <option value="inner">Inner</option>
                    <option value="cover">Cover</option>
                  </BloomSelect>
                </div>
              </div>
            </div>
          ))}
          </div>

        {hasVarnishInProcessRows && (
          <div className="job-card-varnish-route">
            <label className="job-card-varnish-route__label form-label-modern" htmlFor="varnishTaskMode">
              Varnish Task Route *
            </label>
            <BloomSelect
              id="varnishTaskMode"
              className="input-field-modern job-card-varnish-route__select"
              name="varnishTaskMode"
              value={formData.varnishTaskMode || ''}
              options={varnishTaskRouteOptions}
              onChange={e => {
                handleInputChange(e);
                const val = e.target.value;
                if (val === 'printing') {
                  setProcessRows(prev => {
                    const newRows = prev.map(r => ({
                      ...r,
                      machine: 'KOMORI 529'
                    }));
                    setTimeout(() => autoSelectTasks({
                      ...formData,
                      varnishTaskMode: val
                    }, newRows), 0);
                    return newRows;
                  });
                } else {
                  setTimeout(() => autoSelectTasks({
                    ...formData,
                    varnishTaskMode: val
                  }), 0);
                }
              }}
            />
            <p className="job-card-varnish-route__hint">
              Printing = add VARNISH in printing instruction, External = add VARNISH external process
            </p>
          </div>
        )}

        <div className="form-grid-modern">
          <div className="form-group-modern">
            <label className="form-label-modern">Binding Product</label>
            <BloomSelect
              name="bindingProduct"
              value={formData.bindingProduct || ''}
              onChange={handleInputChange}
              className="input-field-modern"
            >
              <option value="">Select Binding Product</option>
              {bindingProductOptions.map((productName) => (
                <option key={productName} value={productName}>
                  {productName}
                </option>
              ))}
            </BloomSelect>
          </div>
          <div className="form-group-modern">
            <label className="form-label-modern">Binding Processes (Auto)</label>
            {bindingProcessRowsWithAmount.length > 0 ? (
              <div className="job-card-binding-process-table">
                <div className="job-card-binding-process-table__head">
                  <div>Process</div>
                  <div>Process Amt</div>
                </div>
                {bindingProcessRowsWithAmount.map((row, idx) => (
                  <div key={`${row.processName}-${idx}`} className="job-card-binding-process-table__row">
                    <div>{row.processName}</div>
                    <div>{row.amount !== '' ? row.amount : '-'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value=""
                className="input-field-modern"
                readOnly
                placeholder="Auto-filled from Binding Product"
              />
            )}
          </div>
        </div>
        </div>

        {/* Fabrication Details Section */}
        <div className="job-card-section">
          <h3 className="job-card-subsection-title">Fabrication Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            {/* Column 1: Internal Fabrication */}
            <div>
              <h4 className="bloom-section-subtitle">Internal Fabrication</h4>
              {(formData.internalFabrications || []).map((fabId, index) => (
                <div key={`int-fab-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <BloomSelect
                    value={fabId || ''}
                    onChange={(e) => {
                      const updated = [...(formData.internalFabrications || [])];
                      updated[index] = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        internalFabrications: updated
                      }));
                    }}
                    className="input-field-modern"
                    style={{ flex: 1 }}
                  >
                    <option value="">Select Internal Fabrication</option>
                    {(internalFabrications || []).filter(fab => getFabLabel(fab)).map((fab) => (
                      <option key={fab.id} value={fab.id}>
                        {getFabLabel(fab)}
                      </option>
                    ))}
                  </BloomSelect>
                  <button
                    type="button"
                    title="Remove"
                    style={{
                      padding: '4px 8px',
                      fontSize: '1rem',
                      flexShrink: 0,
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      background: '#dc3545',
                      color: '#fff',
                      cursor: 'pointer',
                      lineHeight: 1,
                      fontWeight: 700
                    }}
                    onClick={() => {
                      const updated = [...(formData.internalFabrications || [])];
                      updated.splice(index, 1);
                      setFormData(prev => ({
                        ...prev,
                        internalFabrications: updated
                      }));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="save-btn-modern job-card-outline-btn"
                style={{ marginTop: '6px', padding: '6px 14px', fontSize: '0.9rem' }}
                onClick={() => setFormData(prev => ({
                  ...prev,
                  internalFabrications: [...(prev.internalFabrications || []), '']
                }))}
              >
                + Internal Fabrication
              </button>
            </div>

            {/* Column 2: External Fabrication */}
            <div>
              <h4 className="bloom-section-subtitle">External Fabrication</h4>
              {(formData.externalFabrications || []).map((fabId, index) => {
                const selectedFab = (externalFabrications || []).find(fab => String(fab.id) === String(fabId));
                const jointProducts = getFabJointProducts(selectedFab);
                const storedJoint = String((formData.externalFabricationJointProducts?.[index]) || '').trim();
                const productMatch = name => jointProducts.some(j => String(j.product || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());
                const parts = storedJoint ? storedJoint.split(',').map(s => s.trim()).filter(Boolean) : [];
                const multiJoint = parts.length > 1;
                const allPartsMatchMaster = parts.length > 0 && parts.every(productMatch);
                const useReadOnly = jointProducts.length === 0 ? Boolean(storedJoint) : Boolean(storedJoint) && (multiJoint || !allPartsMatchMaster);

                return (
                  <div key={`ext-fab-${index}`} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <BloomSelect
                        value={fabId || ''}
                        onChange={(e) => {
                          const updated = [...(formData.externalFabrications || [])];
                          updated[index] = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            externalFabrications: updated
                          }));
                        }}
                        className="input-field-modern"
                        style={{ flex: 1 }}
                      >
                        <option value="">Select External Fabrication</option>
                        {(externalFabrications || []).filter(fab => getFabLabel(fab)).map((fab) => (
                          <option key={fab.id} value={fab.id}>
                            {getFabLabel(fab)}
                          </option>
                        ))}
                      </BloomSelect>
                      <button
                        type="button"
                        title="Remove"
                        style={{
                          padding: '4px 8px',
                          fontSize: '1rem',
                          flexShrink: 0,
                          border: '1px solid #dc3545',
                          borderRadius: '4px',
                          background: '#dc3545',
                          color: '#fff',
                          cursor: 'pointer',
                          lineHeight: 1,
                          fontWeight: 700
                        }}
                        onClick={() => {
                          const updated = [...(formData.externalFabrications || [])];
                          updated.splice(index, 1);
                          const nextJointProducts = { ...(formData.externalFabricationJointProducts || {}) };
                          delete nextJointProducts[index];
                          setFormData(prev => ({
                            ...prev,
                            externalFabrications: updated,
                            externalFabricationJointProducts: nextJointProducts
                          }));
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {storedJoint && useReadOnly && (
                      <div style={{ marginLeft: '0', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Joint product</div>
                        <input
                          type="text"
                          readOnly={true}
                          value={storedJoint}
                          className="input-field-modern"
                          title="From quotation — add matching joint products on this row in External Fabrication Master to edit as dropdown"
                        />
                      </div>
                    )}

                    {!useReadOnly && jointProducts.length > 0 && (
                      <div style={{ marginLeft: '0', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Joint product</div>
                        <BloomSelect
                          value={storedJoint || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            externalFabricationJointProducts: {
                              ...(prev.externalFabricationJointProducts || {}),
                              [index]: e.target.value
                            }
                          }))}
                          className="input-field-modern"
                        >
                          <option value="">Select Joint Product</option>
                          {jointProducts.map((joint) => (
                            <option key={joint.product} value={joint.product}>
                              {joint.product} {joint.rate ? ` - ₹${joint.rate}` : ''}
                            </option>
                          ))}
                        </BloomSelect>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                className="save-btn-modern job-card-outline-btn"
                style={{ marginTop: '6px', padding: '6px 14px', fontSize: '0.9rem' }}
                onClick={() => setFormData(prev => ({
                  ...prev,
                  externalFabrications: [...(prev.externalFabrications || []), '']
                }))}
              >
                + External Fabrication
              </button>
            </div>

            {/* Column 3: Poster Gumming */}
            <div>
              <h4 className="bloom-section-subtitle">Poster Gumming Strip</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={!!formData.posterGumming}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      posterGumming: checked,
                      ...(checked ? {} : {
                        gummingWidth: '',
                        gummingHeight: '',
                        noOfStrips: '',
                        gummingStripType: ''
                      })
                    }));
                  }}
                  style={{ width: 15, height: 15, accentColor: '#2563eb' }}
                />
                <span style={{ fontSize: '0.9rem', color: '#374151' }}>Enable Poster Gumming</span>
              </label>

              {formData.posterGumming && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>
                      Gumming Width (inch)
                    </label>
                    <input
                      type="text"
                      name="gummingWidth"
                      className="input-field-modern"
                      value={formData.gummingWidth || ''}
                      onChange={handleInputChange}
                      placeholder="e.g. 8.27"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>
                      Gumming Height (inch)
                    </label>
                    <input
                      type="text"
                      name="gummingHeight"
                      className="input-field-modern"
                      value={formData.gummingHeight || ''}
                      onChange={handleInputChange}
                      placeholder="e.g. 11.69"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>
                      No. of Strips
                    </label>
                    <input
                      type="number"
                      name="noOfStrips"
                      className="input-field-modern"
                      value={formData.noOfStrips || ''}
                      onChange={handleInputChange}
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>
                      Gumming Strip Type
                    </label>
                    <BloomSelect
                      name="gummingStripType"
                      className="input-field-modern"
                      value={formData.gummingStripType || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newFormData = {
                          ...formData,
                          gummingStripType: val
                        };
                        if (val) {
                          let label = '';
                          if (val === 'a4_2strip') label = 'a4 poster 2 strip';
                          else if (val === 'a4_3strip') label = 'a4 poster 3 strip';
                          else if (val === 'a3_2strip') label = 'a3 poster 2 strip';
                          else if (val === 'a3_3strip') label = 'a3 poster 3 strip';
                          else if (val === 'full_gumming') label = 'full gumming';

                          if (label) {
                            const matchedFab = (externalFabrications || []).find(f => {
                              const fLab = String(getFabLabel(f) || '').toLowerCase();
                              return fLab.includes(label);
                            });
                            if (matchedFab) {
                              const exFabs = [...(newFormData.externalFabrications || [])];
                              if (!exFabs.includes(matchedFab.id)) {
                                exFabs.push(matchedFab.id);
                              }
                              newFormData.externalFabrications = exFabs;
                            }
                          }
                        }
                        setFormData(newFormData);
                        setTimeout(() => autoSelectTasks(newFormData), 0);
                      }}
                    >
                      <option value="">None</option>
                      <option value="a4_2strip">A4 Poster 2 Strip (₹400/1000pc)</option>
                      <option value="a4_3strip">A4 Poster 3 Strip (₹450/1000pc)</option>
                      <option value="a3_2strip">A3 Poster 2 Strip (₹500/1000pc)</option>
                      <option value="a3_3strip">A3 Poster 3 Strip (₹600/1000pc)</option>
                      <option value="full_gumming">Full Gumming (Area × 1.65 × Sheets / 100)</option>
                    </BloomSelect>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Manager Section */}
        <div className="job-card-section bloom-task-panel">
          <div className="bloom-task-panel__title">Task manager</div>
          {taskManagerLockState.locked ? (
            <div
              className="bloom-task-lock-banner"
              style={{
                margin: '0 0 12px',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #fcd34d',
                background: '#fffbeb',
                color: '#92400e',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  background: '#f59e0b',
                  color: '#ffffff',
                  borderRadius: 4,
                  fontSize: 11,
                  letterSpacing: 0.4,
                }}
              >
                LOCKED
              </span>
              <span>
                Production has already reached <strong>{taskManagerLockState.currentStageLabel}</strong>.
                You can only add, remove, or edit tasks that come AFTER {taskManagerLockState.currentStageLabel}.
                Earlier tasks are read-only.
              </span>
            </div>
          ) : null}
          <div className="bloom-task-table-wrap">
            <table className="bloom-task-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '120px' }}>Task</th>
                  <th style={{ minWidth: '150px' }}>Labels</th>
                  <th style={{ minWidth: '100px' }}>
                    Amount
                    <input
                      type="checkbox"
                      className="bloom-task-th-checkbox"
                      checked={masterAmountSource === 'amount'}
                      onChange={() => {
                        setMasterAmountSource('amount');
                        const newTaskManager = { ...taskManager };
                        Object.keys(newTaskManager).forEach((name) => {
                          if (newTaskManager[name].selected) {
                            newTaskManager[name].amountSource = 'amount';
                          }
                        });
                        setTaskManager(newTaskManager);
                      }}
                    />
                  </th>
                  <th style={{ minWidth: '120px' }}>
                    Quotation Amt
                    <input
                      type="checkbox"
                      className="bloom-task-th-checkbox"
                      checked={masterAmountSource === 'quotationAmount'}
                      onChange={() => {
                        setMasterAmountSource('quotationAmount');
                        const newTaskManager = { ...taskManager };
                        Object.keys(newTaskManager).forEach((name) => {
                          if (newTaskManager[name].selected) {
                            newTaskManager[name].amountSource = 'quotationAmount';
                          }
                        });
                        setTaskManager(newTaskManager);
                      }}
                    />
                  </th>
                  <th style={{ minWidth: '200px' }}>Instructions</th>
                  <th style={{ minWidth: '100px' }}>User</th>
                  <th style={{ minWidth: '120px' }}>Wastage Amount</th>
                </tr>
              </thead>
              <tbody>
                {taskManagerRowOrder.map((taskName) => {
                  const taskData = taskManager[taskName];
                  if (!taskData) return null;
                  const taskTone = getJobCardTaskBloomTone(taskName);
                  const statusNorm = normalizeTaskStatus(taskData.status);
                  const rowLocked = isTaskRowLocked(taskName);
                  const fieldsDisabled = !taskData.selected || rowLocked;
                  const rowClass = [
                    'bloom-task-row',
                    `bloom-task-row--${taskTone}`,
                    taskData.selected ? 'bloom-task-row--selected' : '',
                    rowLocked ? 'bloom-task-row--locked' : '',
                  ].filter(Boolean).join(' ');
                  const lockTitle = rowLocked
                    ? `Locked – production has already reached ${taskManagerLockState.currentStageLabel}. Only tasks after this stage can be edited.`
                    : undefined;
                  return (
                    <tr
                      key={taskName}
                      draggable={isReorderableTask(taskName) && !rowLocked}
                      onDragStart={() => handleTaskDragStart(taskName)}
                      onDragOver={(e) => handleTaskDragOver(e, taskName)}
                      onDrop={() => handleTaskDrop(taskName)}
                      onDragEnd={() => setDragTaskName('')}
                      style={{
                        cursor: rowLocked
                          ? 'not-allowed'
                          : (isReorderableTask(taskName) ? 'grab' : 'default'),
                        opacity: rowLocked ? 0.6 : 1,
                      }}
                      className={rowClass}
                      title={lockTitle}
                    >
                      <td>
                        <div className="bloom-task-name-cell">
                          <input
                            type="checkbox"
                            checked={taskData.selected}
                            onChange={() => toggleTaskSelection(taskName)}
                            disabled={rowLocked}
                          />
                          <span className="bloom-task-name">{getTaskManagerRowLabel(taskName)}</span>
                          {statusNorm ? (
                            <span className={getTaskStatusBloomBadgeClass(statusNorm)}>{statusNorm}</span>
                          ) : null}
                          {rowLocked ? (
                            <span
                              className="bloom-task-lock-badge"
                              style={{
                                marginLeft: 6,
                                padding: '2px 6px',
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#92400e',
                                background: '#fef3c7',
                                border: '1px solid #fcd34d',
                                borderRadius: 4,
                                letterSpacing: 0.3,
                              }}
                              title={lockTitle}
                            >
                              LOCKED
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className="bloom-task-cell-text">{getTaskLabelsColumnValue(taskName, taskData)}</span>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={taskData.amount}
                          onChange={(e) => updateTaskManager(taskName, 'amount', e.target.value)}
                          disabled={fieldsDisabled}
                          className="bloom-task-cell-input input-field-modern"
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={taskData.quotationAmount}
                          onChange={(e) => updateTaskManager(taskName, 'quotationAmount', e.target.value)}
                          disabled={fieldsDisabled}
                          className="bloom-task-cell-input input-field-modern"
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={taskData.instructions}
                          onChange={(e) => updateTaskManager(taskName, 'instructions', e.target.value)}
                          disabled={fieldsDisabled}
                          className="bloom-task-cell-input input-field-modern"
                          placeholder="Enter instructions"
                        />
                      </td>
                      <td>
                        <BloomSelect
                          value={taskData.user}
                          onChange={(e) => updateTaskManager(taskName, 'user', e.target.value)}
                          disabled={fieldsDisabled}
                          className="bloom-task-cell-input input-field-modern"
                        >
                          <option value="">Select</option>
                          <option value="User 1">User 1</option>
                          <option value="User 2">User 2</option>
                          <option value="User 3">User 3</option>
                        </BloomSelect>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={taskData.wastageAmount}
                          onChange={(e) => updateTaskManager(taskName, 'wastageAmount', e.target.value)}
                          disabled={fieldsDisabled}
                          className="bloom-task-cell-input input-field-modern"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bloom-task-footer">
            <strong>Total: </strong>
            <span>
              Selected Tasks:{' '}
              {taskManagerRowOrder.filter((name) => taskManager[name]?.selected).length} / {taskManagerRowOrder.length}
            </span>
          </div>
        </div>

        <div className="form-actions-modern">
          <button type="submit" className="save-btn-modern btn-create-job-card">
            {editingJobCard ? 'Update Job Card' : 'Create Job Card'}
          </button>
          <button
            type="button"
            onClick={() => autoSelectTasks(undefined, undefined, { preserveSelections: true })}
            className="save-btn-modern btn-get-task-amount"
          >
            Get Task Amount
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="save-btn-modern btn-reset-job-card"
          >
            Reset
          </button>
        </div>
      </form>
        </div>
      )}
    </div>
  );
}

export default JobCard;
