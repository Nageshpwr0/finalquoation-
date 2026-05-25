import { resolveAutoRequestPlate } from './requestPlateAutoSelect';

/**
 * Reset status and execution fields of the task manager when repeating a job card
 * to ensure that all tasks start fresh (unstarted / uncompleted).
 */
function resetTaskManagerForRepeat(tm) {
  if (!tm || typeof tm !== 'object') return {};
  const next = { ...tm };

  // Keys to delete from root of taskManager
  delete next.startedJobs;
  delete next.endedJobCards;
  delete next.savedInlineRows;
  delete next.impressionByJob;
  delete next.enterQtyByJob;
  delete next.printingTaskState; // Printing task page state

  // Clean each workflow slice
  for (const key of Object.keys(next)) {
    if (key === 'varnishTaskMode' || key === 'customOrder') {
      continue;
    }
    const slice = next[key];
    if (slice && typeof slice === 'object') {
      const cleanedSlice = { ...slice };
      
      // Delete execution/status tracking keys
      delete cleanedSlice.started;
      delete cleanedSlice.ended;
      delete cleanedSlice.status;
      delete cleanedSlice.startedAt;
      delete cleanedSlice.endedAt;
      delete cleanedSlice.startedBy;
      delete cleanedSlice.endedBy;
      delete cleanedSlice.handledBy;
      delete cleanedSlice.updatedAt;
      delete cleanedSlice.updatedBy;
      delete cleanedSlice.history;
      delete cleanedSlice.savedInlineRows;
      delete cleanedSlice.actualQty;
      delete cleanedSlice.actualImpr;
      delete cleanedSlice.qty;
      delete cleanedSlice.impression;
      delete cleanedSlice.completed;
      delete cleanedSlice.completedAt;
      delete cleanedSlice.completedBy;

      next[key] = cleanedSlice;
    }
  }

  return next;
}

/**
 * Build POST body for a new repeat job card from an existing row (full GET payload).
 */
export function buildRepeatJobCardPayload(source) {
  if (!source || typeof source !== 'object') {
    throw new Error('Invalid job card');
  }

  const {
    id: _id,
    jobCardNum: _jobCardNum,
    createdAt: _createdAt,
    invoiceNo: _invoiceNo,
    invoiceDate: _invoiceDate,
    expenses: _expenses,
    usedForJobCard: _used,
    ...rest
  } = source;

  const ref = String(source.jobCardNum || source.id || '').trim();
  const prevRepeat = String(source.repeatNo || '').trim();

  const plateBy = source.plateBy || 'us';

  const rawTaskManager = source.taskManager && typeof source.taskManager === 'object' ? source.taskManager : {};

  return {
    ...rest,
    jobType: 'repeat',
    repeatNo: prevRepeat || ref,
    requestPlate: resolveAutoRequestPlate('repeat', plateBy),
    plateBy,
    invoiceNo: '',
    invoiceDate: '',
    dispatchDate: source.dispatchDate || '',
    expenses: [],
    processDetails: Array.isArray(source.processDetails) ? source.processDetails : [],
    bindingProcesses: Array.isArray(source.bindingProcesses) ? source.bindingProcesses : [],
    internalFabrications: Array.isArray(source.internalFabrications)
      ? source.internalFabrications
      : [],
    externalFabrications: Array.isArray(source.externalFabrications)
      ? source.externalFabrications
      : [],
    internalFabricationJointProducts:
      source.internalFabricationJointProducts && typeof source.internalFabricationJointProducts === 'object'
        ? source.internalFabricationJointProducts
        : {},
    externalFabricationJointProducts:
      source.externalFabricationJointProducts && typeof source.externalFabricationJointProducts === 'object'
        ? source.externalFabricationJointProducts
        : {},
    taskManager: resetTaskManagerForRepeat(rawTaskManager),
    quotationDetails:
      source.quotationDetails != null
        ? (typeof source.quotationDetails === 'string'
          ? source.quotationDetails
          : JSON.stringify(source.quotationDetails))
        : null,
    quotationDetailsTable: source.quotationDetailsTable ?? null,
  };
}

