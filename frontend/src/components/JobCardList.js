import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generatePdf } from './JobCardPDF';
import { generateScheduleCutsheetPdf } from './ScheduleCutsheetPdf';
import api from '../api';
import JobCardTaskDetailModal from './JobCardTaskDetailModal';
import JobCardDraftModal from './JobCardDraftModal';
import JobCardExpenseModal from './JobCardExpenseModal';
import SchedulePriorityModal from './SchedulePriorityModal';
import '../design-system.css';
import {
  canonicalMachineFilterLabel,
  parseProcessDetailsRaw,
  parseTaskManager,
  getWorkflowStatus,
  filterJobCardsLikeJobCardList,
  getJobCardCreatedByLabel,
  getJobCardListDefaultStartDate,
  getJobCardListDefaultEndDate,
  isJobCardInListDateRange,
  jobCardNumNumericSortKey,
  getDaysPendingToDispatch,
  JOB_CARD_LIST_TASK_STATUS_FILTER_OPTIONS,
  isJobCardInvoiceRowComplete,
  getJobCardListRowBucket,
} from '../utils/jobCardListRowBucket';
import { getJobCardListRowClassName, getJobCardListRowStyle, isMostPriorityJobCard } from '../utils/jobCardPriorityStyle';
import JobCardPriorityBadge from './JobCardPriorityBadge';
import JobCardStatusBadge from './JobCardStatusBadge';
import { buildRepeatJobCardPayload } from '../utils/jobCardRepeat';
import { exportJobCardsToExcel } from '../utils/jobCardListExcelExport';
import { useAuth } from '../contexts/AuthContext';
import { getTimeOfDayGreeting, getLoggedInDisplayName, getGreetingEmoji, setGreetingEmoji, GREETING_EMOJI_PRESETS } from '../utils/timeGreeting';
import BloomGlassSelect from './BloomGlassSelect';

/** Injected styles for the drag-scroll table layout. Synced each load — appending only once meant updates never shipped to the DOM. */
const JOB_CARD_LIST_TABLE_INLINE_CSS = `
    .job-card-list-view,
    .job-card-list-view input,
    .job-card-list-view select,
    .job-card-list-view textarea,
    .job-card-list-view button,
    .job-card-list-view .bloom-glass-select__trigger,
    .job-card-list-view .bloom-glass-select__menu,
    .job-card-list-view .bloom-glass-select__option {
      text-transform: uppercase !important;
    }
    
    html:not([data-theme='dark']) #root .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-pending td,
    html:not([data-theme='dark']) #root .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-pending.job-card-list-data-row td,
    html:not([data-theme='dark']) #root .crm-app.crm-bloom .job-card-list-table tbody tr.jc-row-pending td,
    html:not([data-theme='dark']) #root .job-card-list-table tbody tr.jc-row-pending td,
    html:not([data-theme='dark']) #root tbody tr.jc-row-pending td {
      background: #FFF0F5 !important;
      background-color: #FFF0F5 !important;
      border: 1px solid #FFCCD5 !important;
      border: 1px solid rgba(219, 112, 147, 0.45) !important;
    }
    .job-card-list-scroll { width: 100%; max-width: 100%; overflow: visible; }
    .job-card-list-table-wrap {
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      touch-action: pan-x;
      width: 100%;
      max-width: 100%;
    }
    .dashboard-table-scroll.job-card-list-scroll .job-card-list-table-wrap {
      border: none;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .job-card-list-table {
      table-layout: fixed !important;
      min-width: 1850px !important;
      width: 100% !important;
      display: table !important;
      border-collapse: collapse !important;
    }
    
    /* Light Theme (White Theme) styling - High Specificity Overrides */
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table,
    html:not([data-theme='dark']) .crm-app.crm-bloom .job-card-list-table,
    html:not([data-theme='dark']) .job-card-list-table {
      background-color: #F7F7F7 !important;
    }
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tr,
    html:not([data-theme='dark']) .crm-app.crm-bloom .job-card-list-table tr,
    html:not([data-theme='dark']) .job-card-list-table tr {
      background-color: #F7F7F7 !important;
    }
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr td,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table td,
    html:not([data-theme='dark']) .crm-app.crm-bloom .job-card-list-table td,
    html:not([data-theme='dark']) .job-card-list-table td {
      background-color: #F7F7F7 !important;
    }
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table thead th,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table th,
    html:not([data-theme='dark']) .crm-app.crm-bloom .job-card-list-table th,
    html:not([data-theme='dark']) .job-card-list-table th {
      background-color: #737373 !important;
      color: #ffffff !important;
    }
    
    /* Flat rows — horizontal divider only (no white cell grid) */
    .job-card-list-table th,
    .job-card-list-table td {
      border: none !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22) !important;
    }
    .job-card-list-table {
      border: none !important;
    }
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody td {
      border: none !important;
      border-left: none !important;
      border-right: none !important;
      border-top: none !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22) !important;
      border-radius: 0 !important;
    }
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.job-card-list-data-row td {
      box-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      background: transparent !important;
      background-color: transparent !important;
    }
    /* Priority & status columns — button-like pills (not full-row color) */
    .job-card-list-priority-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 76px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.25;
      border-radius: 0;
      border: 1px solid;
      white-space: nowrap;
      box-shadow: none;
      cursor: default;
      user-select: none;
      letter-spacing: 0.01em;
    }
    .job-card-list-priority-plain {
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      line-height: 1.25;
    }
    html[data-theme='dark'] .job-card-list-priority-plain {
      color: #9a9a9a;
    }
    .job-card-list-priority-badge--urgent {
      background: #fca5a5;
      border-color: #ef4444;
      color: #7f1d1d;
    }
    html[data-theme='dark'] .job-card-list-priority-badge--urgent {
      background: #f87171;
      border-color: #dc2626;
      color: #450a0a;
    }
    .job-card-list-priority-badge--hold {
      background: #fef08a;
      border-color: #eab308;
      color: #713f12;
      font-style: normal;
    }
    html[data-theme='dark'] .job-card-list-priority-badge--hold {
      background: #facc15;
      border-color: #ca8a04;
      color: #422006;
    }
    .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold .job-card-list-priority-badge--hold,
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-on-hold .job-card-list-priority-badge--hold {
      opacity: 1 !important;
      font-style: normal !important;
      color: #713f12 !important;
      background: #fef08a !important;
      border-color: #eab308 !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold .job-card-list-priority-badge--hold,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-on-hold .job-card-list-priority-badge--hold {
      color: #422006 !important;
      background: #facc15 !important;
      border-color: #ca8a04 !important;
    }
    .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold.job-card-list-data-row,
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-on-hold.job-card-list-data-row {
      opacity: 1;
    }
    .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold.job-card-list-data-row td,
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-on-hold.job-card-list-data-row td {
      font-style: italic;
      color: #64748b !important;
      background: #f1f5f9 !important;
    }
    .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold .job-card-list-meta-line,
    .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold .job-card-list-status-sub {
      font-style: italic;
      color: #64748b !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold.job-card-list-data-row td,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-on-hold.job-card-list-data-row td {
      font-style: italic;
      color: #a1a1aa !important;
      background: #27272a !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold .job-card-list-meta-line,
    html[data-theme='dark'] .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold .job-card-list-status-sub {
      color: #a1a1aa !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold:hover td {
      color: #d4d4d8 !important;
    }
    .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold input.job-card-list-compact-input {
      font-style: italic;
      color: #64748b;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .job-card-list-table tbody tr.jc-on-hold input.job-card-list-compact-input {
      color: #a1a1aa;
    }
    .job-card-list-status-badge-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      max-width: 168px;
      max-height: 58px;
      overflow: hidden;
      margin: 0 auto;
    }
    .job-card-list-status-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 72px;
      max-width: 100%;
      padding: 4px 10px;
      font-size: 10px;
      font-weight: 600;
      line-height: 1.25;
      border-radius: 0;
      border: 1px solid;
      white-space: normal;
      text-align: center;
      box-shadow: none;
      cursor: default;
      user-select: none;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .job-card-list-status-badge-sub {
      font-size: 10px;
      font-weight: 500;
      line-height: 1.2;
      color: #64748b;
      text-align: center;
      max-width: 100%;
      word-break: break-word;
    }
    .job-card-list-status-badge--pending {
      background: transparent !important;
      border-color: #94a3b8;
      color: #64748b;
    }
    .job-card-list-status-badge--partial {
      background: #d1fae5;
      border-color: #6ee7b7;
      color: #047857;
    }
    .job-card-list-status-badge--billing {
      background: #d2eafd;
      border-color: #79bff8;
      color: #000000;
    }
    .job-card-list-status-badge--completed {
      background: #4caf50;
      border-color: #459c48;
      color: #ffffff;
    }
    .job-card-list-status-badge--cancelled {
      background: transparent !important;
      border-color: rgba(148, 163, 184, 0.45);
      color: #64748b;
    }
    .job-card-list-status-badge--hold {
      background: #fef08a;
      border-color: #eab308;
      color: #713f12;
    }
    html[data-theme='dark'] .job-card-list-status-badge--pending {
      background: transparent !important;
      border-color: #52525b;
      color: #9a9a9a;
    }
    html[data-theme='dark'] .job-card-list-status-badge--partial {
      background: rgba(110, 231, 183, 0.28);
      border-color: #34d399;
      color: #a7f3d0;
    }
    html[data-theme='dark'] .job-card-list-status-badge--billing {
      background: #d2eafd;
      border-color: #79bff8;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    html[data-theme='dark'] .job-card-list-status-badge--completed {
      background: #4caf50;
      border-color: #459c48;
      color: #ffffff;
    }
    html[data-theme='dark'] .job-card-list-status-badge--cancelled {
      background: rgba(63, 63, 70, 0.55);
      border-color: #52525b;
      color: #a1a1aa;
    }
    html[data-theme='dark'] .job-card-list-status-badge--hold {
      background: #facc15;
      border-color: #ca8a04;
      color: #422006;
    }
    html[data-theme='dark'] .job-card-list-status-badge-sub {
      color: #9a9a9a;
    }
    html[data-theme='dark'] .job-card-list-status-badge--billing + .job-card-list-status-badge-sub {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }

    /* Make table more compact and responsive */
    .job-card-list-table thead th {
      padding: 8px 6px !important;
      font-size: 13px !important;
      line-height: 1.3 !important;
    }
    .job-card-list-table {
      table-layout: fixed !important;
    }

    /* Uniform data-row height — same with/without job image (light & dark) */
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.job-card-list-data-row,
    .crm-app.crm-bloom .job-card-list-table tbody tr.job-card-list-data-row {
      height: 66px !important;
      min-height: 66px !important;
      max-height: 66px !important;
    }
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.job-card-list-data-row td,
    .crm-app.crm-bloom .job-card-list-table tbody tr.job-card-list-data-row td {
      height: 66px !important;
      min-height: 66px !important;
      max-height: 66px !important;
      overflow: hidden !important;
      vertical-align: middle !important;
      padding: 4px 6px !important;
      box-sizing: border-box !important;
    }
    .job-card-list-image-cell {
      width: 130px !important;
      min-width: 130px !important;
      max-width: 130px !important;
      text-align: center !important;
      vertical-align: middle !important;
    }
    .job-card-list-image-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 118px;
      height: 57px;
      max-width: 118px !important;
      max-height: 57px !important;
      overflow: hidden;
    }
    .job-card-list-image-thumb {
      width: 118px !important;
      height: 57px !important;
      max-width: 118px !important;
      max-height: 57px !important;
      object-fit: contain !important;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #ddd;
      display: block;
      margin: 0 auto;
      background-color: rgba(0, 0, 0, 0.02);
      box-sizing: border-box;
    }
    html[data-theme='dark'] .job-card-list-image-thumb {
      border-color: #444;
      background-color: rgba(255, 255, 255, 0.04);
    }
    .job-card-list-image-placeholder {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 118px;
      height: 57px;
      line-height: 1;
      font-size: 16px;
    }
    .job-card-list-datetime-stack {
      max-height: 57px;
      overflow: hidden;
    }
    .job-card-list-machine-cell {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }
    .job-card-list-action-cell {
      overflow: hidden !important;
      padding: 4px 2px !important;
    }
    .job-card-list-action-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      max-height: 58px;
      overflow: hidden;
    }
    .job-card-list-action-row {
      display: flex;
      flex-wrap: nowrap;
      gap: 20px;
      justify-content: center;
    }
    .job-card-list-dispatch-days-cell {
      overflow: hidden !important;
    }
    .job-card-list-dispatch-days-cell > div {
      max-height: 58px;
      overflow: hidden;
    }
    
    /* Compact action buttons */
    .job-card-list-table .save-btn-modern {
      padding: 4px 8px !important;
      font-size: 11px !important;
      margin: 1px !important;
    }
    
    /* Icon-only action buttons — no white tile; colored strokes only */
    .job-card-list-table .jc-list-action-btn--icon {
      padding: 0 !important;
      min-width: 0 !important;
      width: auto !important;
      height: auto !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 0 !important;
      margin: 0 !important;
      font-size: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      cursor: pointer !important;
      position: relative !important;
      filter: none !important;
    }
    .job-card-list-table .jc-list-action-btn--icon::after {
      display: none !important;
      content: none !important;
    }
    .job-card-list-table .jc-list-action-btn--icon:hover:not(:disabled),
    .job-card-list-table .jc-list-action-btn--icon:focus:not(:disabled) {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      filter: brightness(1.15) !important;
      opacity: 0.92;
    }
    
    .jc-list-action-btn--icon:disabled {
      opacity: 0.3 !important;
      cursor: not-allowed !important;
    }
    
    .jc-list-action-btn--icon svg {
      width: 16px !important;
      height: 16px !important;
      fill: none !important;
    }
    
    /* Action icons — dark colors for light mode (better visibility) */
    .job-card-list-table .jc-list-action-btn--draft svg { stroke: #0369a1 !important; }
    .job-card-list-table .jc-list-action-btn--edit svg { stroke: #0891b2 !important; }
    .job-card-list-table .jc-list-action-btn--print svg { stroke: #1d4ed8 !important; }
    .job-card-list-table .jc-list-action-btn--expenses svg { stroke: #d97706 !important; }
    .job-card-list-table .jc-list-action-btn--repeat svg { stroke: #059669 !important; }
    .job-card-list-table .jc-list-action-btn--cancel svg { stroke: #dc2626 !important; }
    .job-card-list-table .jc-list-action-btn--task-detail svg { stroke: #374151 !important; }

    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--icon svg {
      stroke: #e2e8f0 !important;
    }
    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--draft svg { stroke: #7dd3fc !important; }
    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--edit svg { stroke: #a5f3fc !important; }
    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--print svg { stroke: #93c5fd !important; }
    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--expenses svg { stroke: #fde68a !important; }
    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--repeat svg { stroke: #86efac !important; }
    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--cancel svg { stroke: #fca5a5 !important; }
    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--task-detail svg { stroke: #ffffff !important; }

    html[data-theme='dark'] .job-card-list-table .jc-list-action-btn--icon:hover:not(:disabled) svg {
      stroke: #ffffff !important;
      filter: drop-shadow(0 0 4px rgba(125, 211, 252, 0.45));
    }
    
    /* Compact inputs */
    .job-card-list-table .input-box {
      padding: 4px 6px !important;
      font-size: 12px !important;
      height: 28px !important;
    }
    
    /* Responsive adjustments for different screen sizes */
    @media (max-width: 1600px) {
      .job-card-list-table {
        min-width: 1100px !important;
      }
    }
    
    @media (max-width: 1400px) {
      .job-card-list-table {
        min-width: 1000px !important;
      }
      .job-card-list-table th,
      .job-card-list-table td {
        padding: 6px 4px !important;
        font-size: 12px !important;
      }
    }
    
    @media (max-width: 1200px) {
      .job-card-list-table {
        min-width: 900px !important;
      }
    }
    .job-card-list-table thead { display: table-header-group !important; }
    .job-card-list-table tbody { display: table-row-group !important; }
    .job-card-list-table tr {
      display: table-row !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    /* Bloom: flat leaderboard rows — horizontal lines only (see job-card-bloom-theme.css) */
    .crm-app.crm-bloom .job-card-list-table th,
    .crm-app.crm-bloom .job-card-list-table td {
      border: none !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22) !important;
    }
    .crm-app.crm-bloom .job-card-list-table thead th {
      border-bottom: 1px solid rgba(148, 163, 184, 0.35) !important;
    }
    .crm-app.crm-bloom .job-card-list-table tbody tr.job-card-list-data-row:last-child td {
      border-bottom: none !important;
    }
    .crm-app.crm-bloom .job-card-list-table {
      border-collapse: collapse !important;
      border-spacing: 0 !important;
    }
    .crm-app.crm-bloom .job-card-list-table tbody tr.job-card-list-data-row:hover {
      transform: none !important;
      filter: none !important;
    }
    .job-card-list-table th,
    .job-card-list-table td {
      display: table-cell !important;
      vertical-align: middle;
      word-break: normal !important;
      overflow-wrap: normal !important;
    }
    /* Columns wrap text onto a second line beautifully and respect fixed widths */
    .job-card-list-table th,
    .job-card-list-table td {
      white-space: normal !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
    }
    .job-card-list-table th.job-card-list-cell-compact,
    .job-card-list-table td.job-card-list-cell-compact {
      overflow: hidden !important;
      white-space: normal !important;
      box-sizing: border-box !important;
    }
    .job-card-list-table tbody td::before {
      content: none !important;
      display: none !important;
    }
    .result-table-modern.job-card-list-table td.job-card-list-cell-compact,
    .result-table-modern.job-card-list-table th.job-card-list-cell-compact {
      padding: 2px 3px !important;
      box-sizing: border-box;
    }
    .result-table-modern.job-card-list-table th.job-card-list-remark-heading .save-btn-modern {
      min-height: 0 !important;
      padding: 0 2px !important;
      margin-left: 0 !important;
    }
    /* Fixed px height; larger font so invoice / remark fields read clearly on green rows */
    .result-table-modern.job-card-list-table input.job-card-list-compact-input.input-box {
      box-sizing: border-box !important;
      padding: 0 6px !important;
      margin: 0 !important;
      font-size: 15px !important;
      height: 57px !important;
      min-height: 57px !important;
      max-height: none !important;
      line-height: 1.35 !important;
      border-radius: 0 !important;
      background: #ececec !important;
      border: 1px solid rgba(148, 163, 184, 0.38) !important;
      box-shadow: none !important;
    }
    html[data-theme='dark'] .result-table-modern.job-card-list-table input.job-card-list-compact-input.input-box {
      background: #404040 !important;
      color: #e5e5e5 !important;
      border: 1px solid #555555 !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
      color-scheme: dark;
    }
    .result-table-modern.job-card-list-table input.job-card-list-compact-input.input-box[type="date"] {
      padding: 0 2px !important;
      font-size: 14px !important;
      height: 57px !important;
      min-height: 57px !important;
    }
    .result-table-modern.job-card-list-table td.job-card-list-cell-compact input.job-card-list-compact-input {
      width: 100% !important;
      max-width: none !important;
      min-width: 0 !important;
    }
    .result-table-modern.job-card-list-table td.job-card-list-dispatch-date-cell,
    .result-table-modern.job-card-list-table th.job-card-list-dispatch-date-cell {
      text-align: center !important;
      vertical-align: middle !important;
      white-space: normal !important;
      width: 36px !important;
      min-width: 36px !important;
      max-width: 36px !important;
      overflow: visible !important;
      padding-left: 2px !important;
      padding-right: 2px !important;
    }
    .result-table-modern.job-card-list-table td.job-card-list-dispatch-days-cell,
    .result-table-modern.job-card-list-table th.job-card-list-dispatch-days-cell {
      white-space: normal !important;
      text-align: center !important;
      vertical-align: middle !important;
      min-width: 88px !important;
      max-width: 120px !important;
      line-height: 1.25 !important;
    }
    .job-card-list-dispatch-date-picker-wrap {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 28px !important;
      height: 28px !important;
      box-sizing: border-box !important;
      border: none !important;
      background: transparent !important;
      border-radius: 0 !important;
      vertical-align: middle !important;
      padding: 0 !important;
    }
    .job-card-list-dispatch-date-picker-wrap input[type='date'] {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      opacity: 0 !important;
      cursor: pointer !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-sizing: border-box !important;
      z-index: 2 !important;
    }
    .job-card-list-dispatch-date-picker-wrap .job-card-list-dispatch-calendar-glyph {
      pointer-events: none !important;
      position: absolute !important;
      z-index: 1 !important;
      left: 50% !important;
      top: 50% !important;
      transform: translate(-50%, -50%) !important;
    }

    /* === No white glass outlines on cells / rows === */
    .crm-app.crm-bloom .result-table-modern.job-card-list-table {
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      border: none !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr:not(.jc-row-billing):not(.jc-row-partial):not(.jc-row-printing-done):not(.jc-row-completed):not(.jc-most-priority) td {
      border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
    }

    /* === Row contrast (injected each load — beats design-system pink tr:hover #FCEFF3) === */
    .result-table-modern.job-card-list-table tbody tr:hover {
      background: transparent !important;
      background-color: transparent !important;
    }
    .result-table-modern.job-card-list-table .job-card-list-meta-line {
      font-size: 11px !important;
      margin-top: 2px !important;
      line-height: 1.25 !important;
      color: #475569 !important;
    }
    html[data-theme='dark'] .result-table-modern.job-card-list-table tbody tr:hover {
      background: transparent !important;
      background-color: transparent !important;
    }
    /* Row hover effects removed */
    
    /* Light Theme (White Theme) Row Status Colors - Placed last to override transparent data-row td background */
    /* W3.CSS green w3-theme — row matches COMPLETED badge */
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed td,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed.job-card-list-data-row td {
      background: #4caf50 !important;
      background-color: #4caf50 !important;
      color: #1a1a1a !important;
      border-bottom-color: #459c48 !important;
    }
    /* W3.CSS blue theme: w3-theme-l4 row + l3 hover + l2 border */
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial td,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial.job-card-list-data-row td,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done td,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done.job-card-list-data-row td {
      background: #d2eafd !important;
      background-color: #d2eafd !important;
      color: #000000 !important;
      border-bottom-color: #79bff8 !important;
    }
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing td,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing.job-card-list-data-row td {
      background: #d2eafd !important;
      background-color: #d2eafd !important;
      color: #000000 !important;
      border-bottom-color: #79bff8 !important;
    }
    html:not([data-theme='dark']) #root .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-pending td,
    html:not([data-theme='dark']) #root .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-pending.job-card-list-data-row td,
    html:not([data-theme='dark']) #root .crm-app.crm-bloom .job-card-list-table tbody tr.jc-row-pending td,
    html:not([data-theme='dark']) #root .job-card-list-table tbody tr.jc-row-pending td,
    html:not([data-theme='dark']) #root tbody tr.jc-row-pending td {
      background: #FFF0F5 !important;
      background-color: #FFF0F5 !important;
      border: 1px solid #FFCCD5 !important;
      border: 1px solid rgba(219, 112, 147, 0.45) !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing td,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing.job-card-list-data-row td {
      background: #d2eafd !important;
      background-color: #d2eafd !important;
      color: #000000 !important;
      border-bottom: none !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done td,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done.job-card-list-data-row td,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial td,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial.job-card-list-data-row td {
      background: #333333 !important;
      background-color: #333333 !important;
      color: #9a9a9a !important;
      border-bottom: none !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing .job-card-list-meta-line {
      color: #334155 !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing .job-card-list-status-badge-sub {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done .job-card-list-meta-line,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done .job-card-list-status-sub,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial .job-card-list-meta-line,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial .job-card-list-status-sub {
      color: #a1a1aa !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed td,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed.job-card-list-data-row td {
      background: #000000 !important;
      background-color: #000000 !important;
      color: #9a9a9a !important;
      border-bottom: none !important;
    }
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-meta-line,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-status-sub,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-datetime-primary,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-dispatch-label,
    html:not([data-theme='dark']) .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-status-badge-sub {
      color: #475569 !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-meta-line,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-status-sub,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-datetime-primary,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-datetime-stack,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-dispatch-label,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-status-badge-sub {
      color: #a1a1aa !important;
    }
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed input.job-card-list-compact-input.input-box,
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-dispatch-date-picker-wrap input[type='date'] {
      background: #459c48 !important;
      color: #ffffff !important;
      border-color: #ffffff !important;
      color-scheme: dark;
    }
    .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed input.job-card-list-compact-input.input-box::placeholder {
      color: rgba(255, 255, 255, 0.78) !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed input.job-card-list-compact-input.input-box,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-dispatch-date-picker-wrap input[type='date'] {
      background: #404040 !important;
      color: #e5e5e5 !important;
      border-color: #555555 !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-most-priority td {
      background: #7f1d1d !important;
      background-color: #7f1d1d !important;
      color: #fecaca !important;
      border-bottom-color: #991b1b !important;
    }

    /* Dark theme — no row hover highlight (pending rows only; status rows keep fixed colors below) */
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table:not(.saved-quotations-table):not(.corporate-quotation-dashboard-table) tbody tr.job-card-list-data-row:not(.jc-row-completed):not(.jc-row-partial):not(.jc-row-printing-done):not(.jc-row-billing):not(.jc-most-priority):hover td {
      background: transparent !important;
      background-color: transparent !important;
      color: #9a9a9a !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table:not(.saved-quotations-table):not(.corporate-quotation-dashboard-table) tbody tr.job-card-list-data-row:not(.jc-row-completed):not(.jc-row-partial):not(.jc-row-printing-done):not(.jc-row-billing):not(.jc-most-priority):hover .job-card-list-meta-line,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table:not(.saved-quotations-table):not(.corporate-quotation-dashboard-table) tbody tr.job-card-list-data-row:not(.jc-row-completed):not(.jc-row-partial):not(.jc-row-printing-done):not(.jc-row-billing):not(.jc-most-priority):hover .job-card-list-status-sub {
      color: #a1a1aa !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing:hover td {
      background: #d2eafd !important;
      background-color: #d2eafd !important;
      color: #000000 !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done:hover td,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial:hover td {
      background: #333333 !important;
      background-color: #333333 !important;
      color: #9a9a9a !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed:hover td {
      background: #000000 !important;
      background-color: #000000 !important;
      color: #9a9a9a !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed:hover .job-card-list-meta-line,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed:hover .job-card-list-status-sub,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial:hover .job-card-list-meta-line,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial:hover .job-card-list-status-sub,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done:hover .job-card-list-meta-line,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done:hover .job-card-list-status-sub {
      color: #a1a1aa !important;
    }
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-most-priority:hover td {
      background: #7f1d1d !important;
      background-color: #7f1d1d !important;
      color: #fecaca !important;
    }

    /* Dark theme — completed / partial dispatch: same grey as pending rows */
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-dispatch-label,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial .job-card-list-dispatch-label,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done .job-card-list-dispatch-label,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-dispatch-days-cell,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial .job-card-list-dispatch-days-cell,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done .job-card-list-dispatch-days-cell,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed .job-card-list-dispatch-days-cell span,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial .job-card-list-dispatch-days-cell span,
    html[data-theme='dark'] .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done .job-card-list-dispatch-days-cell span {
      color: #a1a1aa !important;
      -webkit-text-fill-color: #a1a1aa !important;
    }

    /* Light theme — enforce uniform row height (overrides cell padding / content expansion) */
    html:not([data-theme='dark']) html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.job-card-list-data-row,
    html:not([data-theme='dark']) html body .crm-app.crm-bloom .job-card-list-table tbody tr.job-card-list-data-row {
      height: 66px !important;
      min-height: 66px !important;
      max-height: 66px !important;
    }
    html:not([data-theme='dark']) html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.job-card-list-data-row td,
    html:not([data-theme='dark']) html body .crm-app.crm-bloom .job-card-list-table tbody tr.job-card-list-data-row td {
      height: 66px !important;
      min-height: 66px !important;
      max-height: 66px !important;
      overflow: hidden !important;
      padding: 4px 6px !important;
      box-sizing: border-box !important;
      vertical-align: middle !important;
    }
    html:not([data-theme='dark']) html body .crm-app.crm-bloom .result-table-modern.job-card-list-table .job-card-list-image-thumb {
      width: 118px !important;
      height: 57px !important;
      max-width: 118px !important;
      max-height: 57px !important;
      object-fit: contain !important;
    }

    /* Dark theme — colored status rows: no border/shadow line under row */
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing.job-card-list-data-row td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial.job-card-list-data-row td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done.job-card-list-data-row td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed.job-card-list-data-row td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-most-priority td,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-most-priority.job-card-list-data-row td {
      border-bottom: none !important;
      box-shadow: none !important;
      outline: none !important;
      filter: none !important;
    }
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-billing,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-partial,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-printing-done,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-row-completed,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table tbody tr.jc-most-priority {
      box-shadow: none !important;
      outline: none !important;
    }

    /* Dark theme — header row labels pure white (beats cursor-dark grey override) */
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table thead th,
    html[data-theme='dark'] html body .crm-app.crm-bloom .job-card-list-table thead th,
    html[data-theme='dark'] html body .crm-app.crm-bloom .result-table-modern.job-card-list-table thead th *,
    html[data-theme='dark'] html body .crm-app.crm-bloom .job-card-list-table thead th * {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
  `;

(function syncJobCardListTableStyles() {
  let el = document.getElementById('job-card-list-table-styles');
  if (!el) {
    el = document.createElement('style');
    el.id = 'job-card-list-table-styles';
    document.head.appendChild(el);
  }
  el.textContent = JOB_CARD_LIST_TABLE_INLINE_CSS;
})();

function jobCardsListSignature(list) {
  if (!Array.isArray(list)) return '';
  return list.map((j) => {
    const id = j?.id ?? '';
    const tm = typeof j?.taskManager === 'string' ? j.taskManager : JSON.stringify(j?.taskManager ?? '');
    const status = j?.status ?? j?.jobType ?? '';
    const inv = `${j?.invoiceNo ?? ''}|${j?.invoiceDate ?? ''}|${j?.remark ?? ''}`;
    return `${id}:${status}:${inv}:${tm}`;
  }).join('||');
}

/** Compact but usable widths; inputs fill cell (`width: 100%` + compact-input CSS). */
/** Dispatch date column — match header calendar glyph */
const JOB_CARD_LIST_CALENDAR_GLYPH_SIZE = 14;
const JOB_CARD_LIST_CALENDAR_GLYPH_STROKE = '#db7093';

const JOB_CARD_LIST_COL_INVOICE_NO = 100;
/** Room for calendar control without clipping common browsers */
const JOB_CARD_LIST_COL_INVOICE_DATE = 100;
/** Wide enough for short remarks + full “Remark” header (≥ 64 ⇒ no “R” abbr.). */
const JOB_CARD_LIST_COL_REMARK = 80;
/** Narrow columns use abbreviated “R” header + × to avoid forcing min width */
const REMARK_COLUMN_USE_SHORT_HEADER = JOB_CARD_LIST_COL_REMARK < 64;
function parseJobCardListDate(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** First line: day, short month name, year; companion time line for smaller typography. */
function getJobCardListDateTimeParts(raw) {
  const d = parseJobCardListDate(raw);
  if (!d) return null;
  const day = d.getDate();
  const month = d.toLocaleString(undefined, { month: 'short' });
  const year = d.getFullYear();
  const timeLine = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return { dateLine: `${day} ${month} ${year}`, timeLine };
}

function JobCardListDateTimeStack({ raw, empty = '' }) {
  const parts = getJobCardListDateTimeParts(raw);
  if (!parts) return <span>{empty}</span>;
  return (
    <div className="job-card-list-datetime-stack">
      <div className="job-card-list-datetime-primary">{parts.dateLine}</div>
      <div className="job-card-list-meta-line">{parts.timeLine}</div>
    </div>
  );
}

/** Readable label for stored dispatch date (`YYYY-MM-DD` from `<input type="date">`). */
function formatDispatchDateLabel(dispatchDateIso) {
  const s = String(dispatchDateIso || '').trim();
  if (!s) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  let d = null;
  if (iso) {
    d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  } else {
    const raw = new Date(s);
    if (!Number.isNaN(raw.getTime())) {
      d = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
    }
  }
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function JobCardCalendarGlyph({ size = 22, className, stroke = '#64748b' }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/** Icons for job card list action column (stroke uses button `color`, typically white). */
function JobCardActionIconSvg({ size = 18, className, children }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Calendar icon only — transparent native `type="date"` covers the glyph and opens picker. */
function JobCardDispatchDatePicker({ jobCardId, value, disabled, onChange, onBlur }) {
  const id = `jc-dispatch-date-${jobCardId}`;
  const fmt = formatDispatchDateLabel(value);
  const hoverTitle = disabled ? undefined : `${fmt ? `${fmt} · ` : ''}Choose dispatch date`;
  return (
    <label
      htmlFor={id}
      title={hoverTitle}
      className="job-card-list-dispatch-date-picker-wrap"
      style={{
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        pointerEvents: disabled ? 'none' : undefined,
      }}
    >
      <input
        id={id}
        type="date"
        disabled={disabled}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label="Dispatch date"
      />
      <JobCardCalendarGlyph
        className="job-card-list-dispatch-calendar-glyph"
        size={JOB_CARD_LIST_CALENDAR_GLYPH_SIZE}
        stroke={JOB_CARD_LIST_CALENDAR_GLYPH_STROKE}
      />
    </label>
  );
}

/** Plates column: qty + entered date/time (from PC2 page saves). */
function JobCardListPlatesCell({ jobCard }) {
  const tm = parseTaskManager(jobCard?.taskManager);
  const fromTm = tm?.pc2Plate?.plateQty;
  let qty = '';
  let enteredRaw = '';

  if (fromTm != null && String(fromTm).trim() !== '') {
    qty = String(fromTm).trim();
    enteredRaw =
      tm?.pc2Plate?.plateQtyEnteredAt
      || (String(tm?.pc2Plate?.status || '').toUpperCase() === 'DONE' ? tm?.pc2Plate?.completedAt : '')
      || '';
  } else {
    const pd = parseProcessDetailsRaw(jobCard?.processDetails);
    const withPlates = pd.find((r) => r && String(r.plates ?? '').trim() !== '');
    if (withPlates) {
      qty = String(withPlates.plates).trim();
    }
  }

  if (!qty) {
    return <span>{jobCard?.requestPlate || '-'}</span>;
  }

  let plateDateTimeParts = null;
  if (enteredRaw && String(enteredRaw).trim() !== '') {
    plateDateTimeParts = getJobCardListDateTimeParts(enteredRaw);
  }

  return (
    <div style={{ lineHeight: 1.25, whiteSpace: 'normal' }}>
      <div style={{ fontWeight: 600 }}>{qty}</div>
      {plateDateTimeParts ? (
        <>
          <div className="job-card-list-datetime-primary" style={{ marginTop: 4 }}>{plateDateTimeParts.dateLine}</div>
          <div className="job-card-list-meta-line">{plateDateTimeParts.timeLine}</div>
        </>
      ) : null}
    </div>
  );
}

function GreetingEmojiPicker({ className = '' }) {
  const [emoji, setEmoji] = useState(getGreetingEmoji);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
      transform: 'translateX(-50%)',
      zIndex: 10050,
    });
  }, []);

  useEffect(() => {
    const onDocClick = (event) => {
      if (
        rootRef.current?.contains(event.target)
        || menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  const applyEmoji = (next) => {
    const saved = setGreetingEmoji(next);
    setEmoji(saved);
    setOpen(false);
  };

  const handleCustomEmoji = () => {
    const typed = typeof window !== 'undefined'
      ? window.prompt('Enter emoji for greeting:', emoji)
      : null;
    if (typed != null && String(typed).trim()) {
      applyEmoji(String(typed).trim());
    }
  };

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className="job-card-bloom__greeting-emoji-menu job-card-bloom__greeting-emoji-menu--portal"
        style={menuStyle}
        role="menu"
      >
        <div className="job-card-bloom__greeting-emoji-grid">
          {GREETING_EMOJI_PRESETS.map((item) => (
            <button
              key={item}
              type="button"
              className={`job-card-bloom__greeting-emoji-option${item === emoji ? ' job-card-bloom__greeting-emoji-option--active' : ''}`}
              onClick={() => applyEmoji(item)}
              title={`Use ${item}`}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="job-card-bloom__greeting-emoji-custom"
          onClick={handleCustomEmoji}
        >
          Custom emoji…
        </button>
      </div>,
      document.body,
    )
    : null;

  return (
    <span ref={rootRef} className={`job-card-bloom__greeting-icon-wrap ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className="job-card-bloom__greeting-icon job-card-bloom__greeting-icon--pick"
        onClick={() => setOpen((v) => !v)}
        title="Click to change greeting emoji"
        aria-label="Change greeting emoji"
        aria-expanded={open}
      >
        {emoji}
      </button>
      {menu}
    </span>
  );
}

function JobCardList({
  apiUrl,
  refreshTrigger,
  onEdit,
  onRepeated,
  laminationTypes,
  internalFabrications = [],
  externalFabrications = [],
  printingMachines = [],
}) {
  const [jobCards, setJobCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(() => getJobCardListDefaultStartDate());
  const [dateTo, setDateTo] = useState(() => getJobCardListDefaultEndDate());
  const [machineFilter, setMachineFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [invoiceDrafts, setInvoiceDrafts] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({
    invoiceNo: true,
    invoiceDate: true,
    remark: true,
  });
  const [rowStatusFilter, setRowStatusFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [createdByFilter, setCreatedByFilter] = useState('all');
  const { hasPermission, isAdmin, user } = useAuth();
  const canViewInvoiceNo = isAdmin() || hasPermission('viewInvoiceNo');
  const canViewInvoiceDate = isAdmin() || hasPermission('viewInvoiceDate');
  const canViewRemark = isAdmin() || hasPermission('viewRemark');
  const [taskDetailJob, setTaskDetailJob] = useState(null);
  const [draftPopupJob, setDraftPopupJob] = useState(null);
  const [expensePopupJob, setExpensePopupJob] = useState(null);
  const [selectedJobCardIds, setSelectedJobCardIds] = useState(() => new Set());
  const [schedulePdfLoading, setSchedulePdfLoading] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleModalJobCards, setScheduleModalJobCards] = useState([]);
  const [repeatLoadingId, setRepeatLoadingId] = useState(null);
  const [exportExcelLoading, setExportExcelLoading] = useState(false);
  const selectAllPageRef = useRef(null);
  const pageSize = 10;

  const openTaskDetailModal = useCallback(async (jobCard) => {
    if (!jobCard?.id) return;
    try {
      const res = await api.get(`/jobcards/${jobCard.id}`);
      const latest = res?.data?.data;
      setTaskDetailJob(latest ? { ...jobCard, ...latest } : jobCard);
    } catch (_) {
      setTaskDetailJob(jobCard);
    }
  }, []);

  const fetchJobCards = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    try {
      const response = await api.get('/jobcards');
      const next = response.data?.data || [];
      setJobCards((prev) => {
        if (jobCardsListSignature(prev) === jobCardsListSignature(next)) return prev;
        return next;
      });
    } catch (error) {
      console.error('Error fetching job cards:', error);
      if (!silent) setJobCards([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobCards();

    // Refresh periodically while list is open — not every second (that caused full-page flicker).
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchJobCards({ silent: true });
    }, 60000);

    const onFocus = () => fetchJobCards({ silent: true });
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [apiUrl, refreshTrigger, fetchJobCards]);

  const prepareJobCardForPdf = async (jobCard) => {
    let latestJobCard = jobCard;
    let quotationDetails = null;
    let taskManager = {};

    if (jobCard?.id) {
      try {
        const latestJobCardRes = await api.get(`/jobcards/${jobCard.id}`);
        if (latestJobCardRes?.data?.data) {
          latestJobCard = { ...jobCard, ...latestJobCardRes.data.data };
        }
      } catch (_e) {
        /* use row snapshot */
      }
    }

    if (latestJobCard.quotationNumber) {
      try {
        const latestQuotationRes = await api.get(`/quotations/${latestJobCard.quotationNumber}`);
        const latestQuotation = latestQuotationRes?.data?.data;
        if (latestQuotation) {
          quotationDetails = latestQuotation;
        }
      } catch (_e) {
        /* use job card snapshot */
      }
    }

    if (latestJobCard.quotationDetails && typeof latestJobCard.quotationDetails === 'string') {
      try {
        quotationDetails = quotationDetails || JSON.parse(latestJobCard.quotationDetails);
      } catch (_e) {
        /* ignore */
      }
    } else if (latestJobCard.quotationDetails) {
      quotationDetails = quotationDetails || latestJobCard.quotationDetails;
    }

    if (latestJobCard.taskManager && typeof latestJobCard.taskManager === 'string') {
      try {
        taskManager = JSON.parse(latestJobCard.taskManager);
      } catch (_e) {
        /* ignore */
      }
    } else if (latestJobCard.taskManager) {
      taskManager = latestJobCard.taskManager;
    }

    return { ...latestJobCard, quotationDetails, taskManager };
  };

  const handlePrint = async (jobCard) => {
    // Open a blank window synchronously at the very start of the user's click action
    // to bypass the browser's aggressive popup blocker.
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write('<title>Generating PDF...</title><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666;"><div><h2>Generating PDF, please wait...</h2></div></body>');
    }

    try {
      const row = await prepareJobCardForPdf(jobCard);
      await generatePdf(row, laminationTypes, row.taskManager, internalFabrications, externalFabrications, newWindow);
    } catch (err) {
      console.error('Error generating PDF:', err);
      if (newWindow) {
        newWindow.document.write('<body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#d32f2f;"><div><h2>Error generating PDF. Please close this tab and try again.</h2></div></body>');
      }
    }
  };

  const handleCancel = async (jobCard) => {
    const alreadyCancelled = String(jobCard?.status || jobCard?.jobType || '').toLowerCase() === 'cancelled';
    if (alreadyCancelled) return;
    if (!window.confirm('Are you sure you want to cancel this job card?')) return;
    try {
      const latestRes = await api.get(`/jobcards/${jobCard.id}`);
      const latest = latestRes?.data?.data || jobCard;
      await api.put(`/jobcards/${jobCard.id}`, {
        ...latest,
        jobType: 'cancelled',
      });
      await fetchJobCards();
    } catch (error) {
      console.error('Cancel job card error:', error);
      window.alert('Failed to cancel job card');
    }
  };

  const handleRepeat = async (jobCard) => {
    if (!jobCard?.id || repeatLoadingId != null) return;
    const label = jobCard.jobCardNum || jobCard.id;
    if (!window.confirm(`Create a new repeat job card from ${label}?`)) return;
    setRepeatLoadingId(jobCard.id);
    try {
      const latestRes = await api.get(`/jobcards/${jobCard.id}`);
      const latest = latestRes?.data?.data || jobCard;
      const payload = buildRepeatJobCardPayload(latest);
      const res = await api.post('/jobcards', payload);
      const created = res?.data?.data;
      const newNum = created?.jobCardNum || res?.data?.jobCardNum;
      await fetchJobCards();
      if (created?.id && onRepeated) {
        const full = await api.get(`/jobcards/${created.id}`);
        const row = full?.data?.data;
        if (row) {
          onRepeated(row);
        } else {
          window.alert(newNum ? `Repeat job card created: ${newNum}` : 'Repeat job card created.');
        }
      } else {
        window.alert(newNum ? `Repeat job card created: ${newNum}` : 'Repeat job card created.');
      }
    } catch (error) {
      console.error('Repeat job card error:', error);
      window.alert(error?.response?.data?.error || error?.message || 'Failed to create repeat job card.');
    } finally {
      setRepeatLoadingId(null);
    }
  };

  const handleInvoiceDraftChange = (jobCardId, field, value) => {
    setInvoiceDrafts((prev) => ({
      ...prev,
      [jobCardId]: {
        ...(prev[jobCardId] || {}),
        [field]: value,
      },
    }));
  };

  const handleInvoiceDraftSave = async (jobCard) => {
    const draft = invoiceDrafts[jobCard.id] || {};
    const invoiceNo = draft.invoiceNo != null ? draft.invoiceNo : (jobCard.invoiceNo || '');
    const invoiceDate = draft.invoiceDate != null ? draft.invoiceDate : (jobCard.invoiceDate || '');
    const dispatchDate = draft.dispatchDate != null ? draft.dispatchDate : (jobCard.dispatchDate || '');
    const remark = draft.remark != null ? draft.remark : (jobCard.remark || '');
    try {
      const latestRes = await api.get(`/jobcards/${jobCard.id}`);
      const latest = latestRes?.data?.data || jobCard;
      await api.put(`/jobcards/${jobCard.id}`, {
        ...latest,
        invoiceNo,
        invoiceDate,
        dispatchDate,
        remark,
      });
      await fetchJobCards();
    } catch (error) {
      console.error('Save invoice fields error:', error);
    }
  };

  const machineFilterOptions = useMemo(() => {
    const fromMaster = (Array.isArray(printingMachines) ? printingMachines : [])
      .map((m) => canonicalMachineFilterLabel(m?.machineName))
      .filter(Boolean);
    const fromCards = [];
    jobCards.forEach((jc) => {
      parseProcessDetailsRaw(jc?.processDetails).forEach((line) => {
        const l = canonicalMachineFilterLabel(line?.machine);
        if (l) fromCards.push(l);
      });
    });
    return Array.from(new Set([...fromMaster, ...fromCards])).sort((a, b) => a.localeCompare(b));
  }, [printingMachines, jobCards]);

  const createdByFilterOptions = useMemo(() => {
    const names = new Set();
    let hasUnset = false;
    jobCards.forEach((jc) => {
      const label = getJobCardCreatedByLabel(jc);
      if (label) names.add(label);
      else hasUnset = true;
    });
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return { sorted, hasUnset };
  }, [jobCards]);

  const statusFilteredJobCards = useMemo(() => {
    const filtered = filterJobCardsLikeJobCardList(jobCards, {
      searchTerm,
      dateFrom,
      dateTo,
      machineFilter,
      rowStatusFilter,
      taskStatusFilter,
      createdByFilter,
      invoiceDrafts,
    });
    // Newest job card numbers first (page 1), then higher id as tiebreaker
    return [...filtered].sort((a, b) => {
      const nb = jobCardNumNumericSortKey(b);
      const na = jobCardNumNumericSortKey(a);
      if (nb !== na) return nb - na;
      return (parseInt(String(b.id), 10) || 0) - (parseInt(String(a.id), 10) || 0);
    });
  }, [jobCards, searchTerm, dateFrom, dateTo, machineFilter, rowStatusFilter, taskStatusFilter, createdByFilter, invoiceDrafts]);

  const isDefaultDateRange = dateFrom === getJobCardListDefaultStartDate() && dateTo === getJobCardListDefaultEndDate();
  const hasActiveFilters = Boolean(
    searchTerm
    || !isDefaultDateRange
    || machineFilter !== 'all'
    || rowStatusFilter !== 'all'
    || taskStatusFilter !== 'all'
    || createdByFilter !== 'all'
  );

  /** Job cards in the selected date range only (for Excel export). */
  const dateRangeJobCards = useMemo(() => {
    const filtered = filterJobCardsLikeJobCardList(jobCards, {
      dateFrom,
      dateTo,
      searchTerm: '',
      machineFilter: 'all',
      rowStatusFilter: 'all',
      taskStatusFilter: 'all',
      createdByFilter: 'all',
      invoiceDrafts,
    });
    return filtered;
  }, [jobCards, dateFrom, dateTo, invoiceDrafts]);

  const handleExportExcel = useCallback(() => {
    if (exportExcelLoading) return;
    if (dateRangeJobCards.length === 0) {
      window.alert(`No job cards found between ${dateFrom} and ${dateTo}.`);
      return;
    }
    setExportExcelLoading(true);
    try {
      const result = exportJobCardsToExcel(dateRangeJobCards, {
        dateFrom,
        dateTo,
        invoiceDrafts,
        canViewInvoiceNo,
        canViewInvoiceDate,
        canViewRemark,
      });
      if (!result.ok) {
        window.alert('No job cards to export for the selected dates.');
      }
    } catch (err) {
      console.error('Excel export error:', err);
      window.alert('Failed to export Excel file. Please try again.');
    } finally {
      setExportExcelLoading(false);
    }
  }, [
    exportExcelLoading,
    dateRangeJobCards,
    dateFrom,
    dateTo,
    invoiceDrafts,
    canViewInvoiceNo,
    canViewInvoiceDate,
    canViewRemark,
  ]);

  const handleSchedulePrioritiesSaved = useCallback(async (savedUpdates) => {
    if (Array.isArray(savedUpdates) && savedUpdates.length > 0) {
      setJobCards((prev) =>
        prev.map((jc) => {
          const hit = savedUpdates.find((s) => String(s.id) === String(jc.id));
          return hit ? { ...jc, priority: hit.priority } : jc;
        })
      );
    }
    await fetchJobCards();
  }, []);

  const openScheduleModal = () => {
    if (selectedJobCardIds.size === 0) return;
    const selectedRows = statusFilteredJobCards.filter((jc) => selectedJobCardIds.has(String(jc.id)));
    if (selectedRows.length === 0) {
      window.alert('No matching job cards in the current list. Clear filters or adjust your selection.');
      return;
    }
    setScheduleModalJobCards(selectedRows);
    setScheduleModalOpen(true);
  };

  const handleScheduleModalPrint = async (ordered, options = {}) => {
    if (!ordered.length) return;
    setSchedulePdfLoading(true);
    try {
      const prepared = [];
      for (const { jobCard, priority } of ordered) {
        const scheduleProcessDetails = Array.isArray(jobCard.processDetails)
          ? [...jobCard.processDetails]
          : null;
        const row = await prepareJobCardForPdf(jobCard);
        if (scheduleProcessDetails) {
          row.processDetails = scheduleProcessDetails;
        }
        if (priority === 'urgent') row.schedulePriority = 'urgent';
        else if (priority === 'regular') row.schedulePriority = 'regular';
        else if (priority === 'hold') row.schedulePriority = 'hold';
        prepared.push(row);
      }
      generateScheduleCutsheetPdf(prepared, {
        hideCustomerColumn: !!options.hideCustomerColumn,
        laminationTypes,
      });
    } catch (error) {
      console.error('Create schedule PDF error:', error);
      window.alert('Failed to create schedule PDF');
    } finally {
      setSchedulePdfLoading(false);
    }
  };

  const pagedJobCards = statusFilteredJobCards.slice((page - 1) * pageSize, page * pageSize);

  const pageRowIds = useMemo(
    () => pagedJobCards.map((j) => String(j?.id ?? '')).filter(Boolean),
    [pagedJobCards]
  );
  const allPageRowsSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedJobCardIds.has(id));
  const somePageRowsSelected = pageRowIds.some((id) => selectedJobCardIds.has(id));

  useEffect(() => {
    const el = selectAllPageRef.current;
    if (el) el.indeterminate = somePageRowsSelected && !allPageRowsSelected;
  }, [somePageRowsSelected, allPageRowsSelected]);

  const toggleSelectJob = useCallback((id) => {
    const sid = String(id);
    setSelectedJobCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedJobCardIds((prev) => {
      const next = new Set(prev);
      const ids = pagedJobCards.map((j) => String(j?.id ?? '')).filter(Boolean);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, [pagedJobCards]);

  const toggleColumnVisibility = (_key) => {};

  const listStats = useMemo(() => {
    let billPending = 0;
    let completePartial = 0;
    let pendingJobCards = 0;
    let priority = 0;
    jobCards.forEach((jc) => {
      if (!isJobCardInListDateRange(jc, dateFrom, dateTo)) return;
      const draft = invoiceDrafts[jc.id] || {};
      const bucket = getJobCardListRowBucket(jc, draft);
      if (bucket === 'cancelled') return;
      if (bucket === 'billing_pending') billPending += 1;
      else if (bucket === 'partial') completePartial += 1;
      else if (bucket === 'pending') pendingJobCards += 1;
      if (isMostPriorityJobCard(jc)) priority += 1;
    });
    return { billPending, completePartial, pendingJobCards, priority };
  }, [jobCards, invoiceDrafts, dateFrom, dateTo]);

  if (loading) {
    return <div className="job-card-list-view" style={{ padding: 24, color: '#64748b' }}>Loading job cards…</div>;
  }

  return (
    <div className="dashboard-view job-card-list-view">
      <div className="job-card-bloom__stats job-card-bloom__stats--with-welcome">
        <div className="job-card-bloom__stat-card job-card-bloom__stat-card--welcome job-card-bloom__stat-card--rose">
          <h2 className="job-card-bloom__greeting job-card-bloom__greeting--personal job-card-bloom__welcome-greeting">
            <span className="job-card-bloom__greeting-label">{getTimeOfDayGreeting()},</span>
            <span className="job-card-bloom__greeting-name">{getLoggedInDisplayName(user)}</span>
            <GreetingEmojiPicker />
          </h2>
        </div>
        <div className="job-card-bloom__stat-card job-card-bloom__stat-card--sky">
          <div className="job-card-bloom__stat-label">Bill Pending</div>
          <div className="job-card-bloom__stat-value">{listStats.billPending}</div>
        </div>
        <div className="job-card-bloom__stat-card job-card-bloom__stat-card--mint">
          <div className="job-card-bloom__stat-label">Complete Partial</div>
          <div className="job-card-bloom__stat-value">{listStats.completePartial}</div>
          <div className="job-card-bloom__stat-trend">Printing done</div>
        </div>
        <div className="job-card-bloom__stat-card job-card-bloom__stat-card--peach">
          <div className="job-card-bloom__stat-label">Pending Job cards</div>
          <div className="job-card-bloom__stat-value">{listStats.pendingJobCards}</div>
        </div>
        <div className="job-card-bloom__stat-card job-card-bloom__stat-card--lavender">
          <div className="job-card-bloom__stat-label">Priority</div>
          <div className="job-card-bloom__stat-value">{listStats.priority}</div>
        </div>
      </div>

      <div
        className="job-card-list-filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px 16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="joblist-date-from" className="job-card-list-filter-label">
            From
          </label>
          <input
            id="joblist-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || getJobCardListDefaultEndDate()}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="input-field-modern job-card-list-filter-date"
            style={{ height: '42px', width: 'auto', minWidth: '148px' }}
            aria-label="Filter from date"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="joblist-date-to" className="job-card-list-filter-label">
            To
          </label>
          <input
            id="joblist-date-to"
            type="date"
            value={dateTo}
            min={dateFrom}
            max={getJobCardListDefaultEndDate()}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="input-field-modern job-card-list-filter-date"
            style={{ height: '42px', width: 'auto', minWidth: '148px' }}
            aria-label="Filter to date"
          />
        </div>
        <input
          type="text"
          placeholder="Search job cards..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="input-field-modern job-card-list-filter-search"
          style={{
            width: 'min(420px, 100%)',
            height: '42px',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="joblist-machine-filter" className="job-card-list-filter-label">
            Machine
          </label>
          <BloomGlassSelect
            id="joblist-machine-filter"
            minWidth={180}
            maxWidth={260}
            value={machineFilter}
            onChange={(v) => {
              setMachineFilter(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All machines' },
              ...machineFilterOptions.map((m) => ({ value: m, label: m })),
            ]}
            aria-label="Filter by machine"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="joblist-status-filter" className="job-card-list-filter-label" title="Overall list bucket (pending, partial, etc.)">
            Progress
          </label>
          <BloomGlassSelect
            id="joblist-status-filter"
            minWidth={190}
            value={rowStatusFilter}
            onChange={(v) => {
              setRowStatusFilter(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'hold', label: 'Hold' },
              { value: 'partial', label: 'Complete partial' },
              { value: 'billing_pending', label: 'Billing pending' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            aria-label="Filter by progress"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="joblist-task-status-filter" className="job-card-list-filter-label" title="Matches the Status column (current task stage)">
            Task status
          </label>
          <BloomGlassSelect
            id="joblist-task-status-filter"
            minWidth={200}
            maxWidth={260}
            value={taskStatusFilter}
            onChange={(v) => {
              setTaskStatusFilter(v);
              setPage(1);
            }}
            options={JOB_CARD_LIST_TASK_STATUS_FILTER_OPTIONS}
            aria-label="Filter by task status"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="joblist-created-by-filter" className="job-card-list-filter-label">
            Created by
          </label>
          <BloomGlassSelect
            id="joblist-created-by-filter"
            minWidth={160}
            maxWidth={220}
            value={createdByFilter}
            onChange={(v) => {
              setCreatedByFilter(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All users' },
              ...(createdByFilterOptions.hasUnset ? [{ value: '__unset__', label: '(Not set)' }] : []),
              ...createdByFilterOptions.sorted.map((name) => ({ value: name, label: name })),
            ]}
            aria-label="Filter by creator"
          />
        </div>
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exportExcelLoading || dateRangeJobCards.length === 0}
          className="save-btn-modern job-card-list-export-excel-btn"
          style={{ padding: '10px 18px', height: 44 }}
          title={`Export job cards from ${dateFrom} to ${dateTo} to Excel`}
        >
          {exportExcelLoading ? 'Exporting…' : 'Export Excel'}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setDateFrom(getJobCardListDefaultStartDate());
              setDateTo(getJobCardListDefaultEndDate());
              setMachineFilter('all');
              setRowStatusFilter('all');
              setTaskStatusFilter('all');
              setCreatedByFilter('all');
              setPage(1);
            }}
            className="save-btn-modern"
            style={{ padding: '10px 18px', height: 44 }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="dashboard-table-scroll job-card-list-scroll" style={{ maxWidth: '100%', overflowX: 'auto' }}>
        <p className="job-card-list-scroll-hint">
          Drag left or right to see all columns.
        </p>
        <div className="job-card-list-column-toggles" style={{ display: 'none' }}></div>
        <div className="job-card-list-table-wrap">
        <table className="result-table-modern job-card-list-table">
          <thead>
            <tr>
              <th style={{ width: '42px', minWidth: '42px', maxWidth: '42px', textAlign: 'center', verticalAlign: 'middle' }}>
                <input
                  ref={selectAllPageRef}
                  type="checkbox"
                  checked={allPageRowsSelected}
                  onChange={toggleSelectAllOnPage}
                  disabled={pageRowIds.length === 0}
                  aria-label="Select all job cards on this page"
                  style={{ width: 18, height: 18, cursor: pageRowIds.length === 0 ? 'not-allowed' : 'pointer' }}
                />
              </th>
              <th style={{ width: '55px', minWidth: '55px', maxWidth: '55px' }}>Sr No.</th>
              <th style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}>Job Card ID</th>
              <th style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>Machine</th>
              <th style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>Product Name</th>
              <th style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>Quotation No</th>
              <th style={{ width: '95px', minWidth: '95px', maxWidth: '95px' }}>Priority</th>
              <th style={{ width: '115px', minWidth: '115px', maxWidth: '115px' }}>Job Card Date</th>
              <th style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>Job Name</th>
              <th style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>Job Image</th>
              <th style={{ width: '170px', minWidth: '170px', maxWidth: '170px' }}>Customer Name</th>
              <th style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}>CreatedBy</th>
              <th style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}>Plates</th>
              {canViewInvoiceNo && (
                <th className="job-card-list-cell-compact" style={{ width: '110px', minWidth: '110px', maxWidth: '110px', whiteSpace: 'normal', verticalAlign: 'middle' }}>
                  Invoice No
                </th>
              )}
              {canViewInvoiceDate && (
                <th className="job-card-list-cell-compact" style={{ width: '110px', minWidth: '110px', maxWidth: '110px', whiteSpace: 'normal', verticalAlign: 'middle' }}>
                  Invoice Date
                </th>
              )}
              {canViewRemark && (
                <th className="job-card-list-cell-compact job-card-list-remark-heading" title="Remark" style={{ width: '110px', minWidth: '110px', maxWidth: '110px', whiteSpace: 'normal', verticalAlign: 'middle' }}>
                  {REMARK_COLUMN_USE_SHORT_HEADER ? <span style={{ fontSize: 11, fontWeight: 700 }}>R</span> : 'Remark'}
                </th>
              )}
              <th style={{ width: '115px', minWidth: '115px', maxWidth: '115px' }}>Status</th>
              <th style={{ width: '45px', minWidth: '45px', maxWidth: '45px', textAlign: 'center', verticalAlign: 'middle' }} title="Choose dispatch date (calendar)">
                <JobCardCalendarGlyph size={JOB_CARD_LIST_CALENDAR_GLYPH_SIZE} stroke={JOB_CARD_LIST_CALENDAR_GLYPH_STROKE} />
              </th>
              <th style={{ width: '95px', minWidth: '95px', maxWidth: '95px', textAlign: 'center', verticalAlign: 'middle' }} title="Days remaining until dispatch; date shown below">
                Dispatch Days
              </th>
              <th style={{ width: '190px', minWidth: '190px', maxWidth: '190px', padding: '8px 2px !important', textAlign: 'center', verticalAlign: 'middle' }}>Action</th>
              <th style={{ width: '55px', minWidth: '55px', maxWidth: '55px', textAlign: 'center', verticalAlign: 'middle' }}>View</th>
            </tr>
          </thead>
          <tbody>
            {statusFilteredJobCards.length === 0 ? (
              <tr>
                <td colSpan={21} style={{ textAlign: 'center' }}>
                  {hasActiveFilters
                    ? 'No job cards match the current filters.'
                    : 'No job cards created yet.'}
                </td>
              </tr>
            ) : (
              pagedJobCards.map((jobCard, rowIndex) => {
                const machineNames = jobCard.processDetails
                  ?.map((p) => p.machine)
                  .filter((m) => m)
                  .filter((machine, index, arr) => arr.indexOf(machine) === index) || [];
                const isCancelled = String(jobCard.status || jobCard.jobType || '').toLowerCase() === 'cancelled';
                const draft = invoiceDrafts[jobCard.id] || {};
                const invoiceNo = draft.invoiceNo != null ? draft.invoiceNo : (jobCard.invoiceNo || '');
                const invoiceDate = draft.invoiceDate != null ? draft.invoiceDate : (jobCard.invoiceDate || '');
                const remark = draft.remark != null ? draft.remark : (jobCard.remark || '');
                const dispatchDate = draft.dispatchDate != null ? draft.dispatchDate : (jobCard.dispatchDate || '');
                const daysPendingDispatch = getDaysPendingToDispatch(dispatchDate);
                const dispatchDateLabel = formatDispatchDateLabel(dispatchDate);
                const isCompleted = isJobCardInvoiceRowComplete(jobCard, draft);
                const isPrintingEnded = String(parseTaskManager(jobCard?.taskManager)?.printing?.status || '').toUpperCase() === 'DONE'
                  || String(parseTaskManager(jobCard?.taskManager)?.printing2?.status || '').toUpperCase() === 'DONE';
                const workflowStatus = getWorkflowStatus(jobCard, isCancelled, isCompleted);
                
                // Dynamic row status classes
                let statusClass = 'jc-row-pending';
                if (isCompleted) {
                  statusClass = 'jc-row-completed';
                } else if (isPrintingEnded) {
                  statusClass = 'jc-row-partial jc-row-printing-done';
                } else if (workflowStatus?.main === 'BILLING' || workflowStatus?.main === 'READY TO DISPATCH') {
                  statusClass = 'jc-row-billing';
                }
                const useWhiteDispatchDaysText = false;

                return (
                  <tr
                    key={jobCard.id}
                    className={getJobCardListRowClassName(jobCard, { isCancelled, isCompleted }) + ' ' + statusClass}
                    style={getJobCardListRowStyle(jobCard, { isCancelled, isCompleted })}
                  >
                    <td
                      style={{ textAlign: 'center', verticalAlign: 'middle' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedJobCardIds.has(String(jobCard.id))}
                        onChange={() => toggleSelectJob(jobCard.id)}
                        aria-label={`Select job card ${jobCard.jobCardNum || jobCard.id}`}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </td>
                    <td>{((page - 1) * pageSize) + rowIndex + 1}</td>
                    <td style={{ minWidth: '70px', width: '70px' }}>{jobCard.jobCardNum || '-'}</td>
                    <td
                      className="job-card-list-machine-cell"
                      title={machineNames.length > 0 ? machineNames.join(', ') : undefined}
                    >
                      {machineNames.length === 0 ? 'N/A' : machineNames.join(', ')}
                    </td>
                    <td>{jobCard.productName || '-'}</td>
                    <td style={{ minWidth: '50px', width: '50px' }}>{jobCard.quotationNumber || '-'}</td>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <JobCardPriorityBadge jobCard={jobCard} />
                    </td>
                    <td style={{ whiteSpace: 'normal', verticalAlign: 'middle' }}>
                      <JobCardListDateTimeStack raw={jobCard.createdAt} empty="-" />
                    </td>
                    <td>{jobCard.jobName || '-'}</td>
                    <td className="job-card-list-image-cell">
                      {jobCard.imageData ? (
                        <div className="job-card-list-image-wrap">
                          <img 
                            className="job-card-list-image-thumb"
                            src={jobCard.imageData} 
                            alt={jobCard.imageAttached || 'Job image'}
                            onClick={() => window.open(jobCard.imageData, '_blank')}
                            onMouseEnter={(e) => {
                              const preview = document.createElement('img');
                              preview.src = jobCard.imageData;
                              preview.style.cssText = `
                                position: fixed;
                                width: 250px;
                                height: 176px;
                                object-fit: contain;
                                background-color: rgba(26, 26, 26, 0.95);
                                border: 2px solid #333;
                                border-radius: 4px;
                                z-index: 1000;
                                pointer-events: none;
                                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                              `;
                              preview.id = 'image-preview';
                              document.body.appendChild(preview);
                              
                              const updatePosition = (event) => {
                                let left = event.clientX + 15;
                                let top = event.clientY + 15;
                                const width = 250;
                                const height = 176;
                                
                                // Flip to left of cursor if it overflows the right edge of viewport
                                if (left + width > window.innerWidth) {
                                  left = event.clientX - width - 15;
                                }
                                // Shift up if it overflows the bottom edge of viewport
                                if (top + height > window.innerHeight) {
                                  top = window.innerHeight - height - 15;
                                }
                                
                                // Ensure it doesn't go off-screen on the left/top
                                if (left < 10) left = 10;
                                if (top < 10) top = 10;
                                
                                preview.style.left = left + 'px';
                                preview.style.top = top + 'px';
                              };
                              updatePosition(e);
                              e.target.addEventListener('mousemove', updatePosition);
                            }}
                            onMouseLeave={(e) => {
                              const preview = document.getElementById('image-preview');
                              if (preview) preview.remove();
                              e.target.removeEventListener('mousemove', () => {});
                            }}
                          />
                        </div>
                      ) : (
                        <span
                          className="job-card-list-image-placeholder"
                          style={{ color: jobCard.imageAttached ? '#28a745' : '#dc3545' }}
                        >
                          {jobCard.imageAttached ? '✓' : '✗'}
                        </span>
                      )}
                    </td>
                    <td style={{ minWidth: '150px' }}>{jobCard.customerName || '-'}</td>
                    <td>{jobCard.createdBy || jobCard.createdByUsername || jobCard.username || '-'}</td>
                    <td style={{ minWidth: '88px', whiteSpace: 'normal', verticalAlign: 'middle' }}>
                      <JobCardListPlatesCell jobCard={jobCard} />
                    </td>
                    {canViewInvoiceNo && (
                      <td className="job-card-list-cell-compact" style={{ minWidth: JOB_CARD_LIST_COL_INVOICE_NO, width: JOB_CARD_LIST_COL_INVOICE_NO, maxWidth: JOB_CARD_LIST_COL_INVOICE_NO, whiteSpace: 'normal', verticalAlign: 'middle' }}>
                        <input className="input-box job-card-list-compact-input" style={{ boxSizing: 'border-box' }} value={invoiceNo} title={invoiceNo || undefined} onChange={(e) => handleInvoiceDraftChange(jobCard.id, 'invoiceNo', e.target.value)} onBlur={() => handleInvoiceDraftSave(jobCard)} />
                      </td>
                    )}
                    {canViewInvoiceDate && (
                      <td className="job-card-list-cell-compact" style={{ minWidth: JOB_CARD_LIST_COL_INVOICE_DATE, width: JOB_CARD_LIST_COL_INVOICE_DATE, maxWidth: JOB_CARD_LIST_COL_INVOICE_DATE, whiteSpace: 'normal', verticalAlign: 'middle' }}>
                        <input className="input-box job-card-list-compact-input" style={{ boxSizing: 'border-box' }} type="date" value={invoiceDate} title={invoiceDate || undefined} onChange={(e) => handleInvoiceDraftChange(jobCard.id, 'invoiceDate', e.target.value)} onBlur={() => handleInvoiceDraftSave(jobCard)} />
                      </td>
                    )}
                    {canViewRemark && (
                      <td className="job-card-list-cell-compact" style={{ minWidth: JOB_CARD_LIST_COL_REMARK, width: JOB_CARD_LIST_COL_REMARK, maxWidth: JOB_CARD_LIST_COL_REMARK, whiteSpace: 'normal', verticalAlign: 'middle' }}>
                        <input className="input-box job-card-list-compact-input" style={{ boxSizing: 'border-box' }} value={remark} title={remark ? String(remark) : undefined} onChange={(e) => handleInvoiceDraftChange(jobCard.id, 'remark', e.target.value)} onBlur={() => handleInvoiceDraftSave(jobCard)} />
                      </td>
                    )}
                    <td style={{ textAlign: 'center', verticalAlign: 'middle', minWidth: 120 }}>
                      <JobCardStatusBadge
                        jobCard={jobCard}
                        workflowStatus={workflowStatus}
                        invoiceDraft={draft}
                      />
                    </td>
                    <td className="job-card-list-dispatch-date-cell">
                      <JobCardDispatchDatePicker
                        jobCardId={jobCard.id}
                        value={dispatchDate}
                        disabled={isCancelled}
                        onChange={(v) => handleInvoiceDraftChange(jobCard.id, 'dispatchDate', v)}
                        onBlur={() => handleInvoiceDraftSave(jobCard)}
                      />
                    </td>
                    <td className="job-card-list-dispatch-days-cell">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <div style={{ fontWeight: daysPendingDispatch != null && daysPendingDispatch <= 0 ? 600 : 500 }}>
                          {daysPendingDispatch == null ? (
                            '-'
                          ) : (
                            <span
                              title={
                                daysPendingDispatch > 0
                                  ? `${daysPendingDispatch} day(s) until dispatch`
                                  : daysPendingDispatch === 0
                                    ? 'Dispatch due today'
                                    : `${Math.abs(daysPendingDispatch)} day(s) overdue`
                              }
                              style={{
                                ...(daysPendingDispatch < 0
                                  ? { color: useWhiteDispatchDaysText ? '#fff' : '#dc3545' }
                                  : daysPendingDispatch === 0
                                    ? { color: useWhiteDispatchDaysText ? '#fff' : '#b45309' }
                                    : useWhiteDispatchDaysText
                                      ? { color: '#fff' }
                                      : {}),
                              }}
                            >
                              {daysPendingDispatch}
                            </span>
                          )}
                        </div>
                        {dispatchDateLabel ? (
                          <div className="job-card-list-meta-line job-card-list-dispatch-label">
                            {dispatchDateLabel}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="job-card-list-action-cell" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <div className="job-card-list-action-stack">
                        <div className="job-card-list-action-row">
                          <button
                            type="button"
                            onClick={() => setDraftPopupJob(jobCard)}
                            className="jc-list-action-btn jc-list-action-btn--draft jc-list-action-btn--icon"
                            disabled={isCancelled}
                            title="Draft"
                            aria-label="Draft"
                          >
                            <JobCardActionIconSvg>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <line x1="10" y1="9" x2="8" y2="9" />
                            </JobCardActionIconSvg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isCompleted) onEdit(jobCard);
                            }}
                            className="jc-list-action-btn jc-list-action-btn--edit jc-list-action-btn--icon"
                            disabled={isCancelled || isCompleted}
                            title={isCompleted ? 'View (completed)' : 'Edit'}
                            aria-label={isCompleted ? 'View job card' : 'Edit job card'}
                          >
                            {isCompleted ? (
                              <JobCardActionIconSvg>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </JobCardActionIconSvg>
                            ) : (
                              <JobCardActionIconSvg>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </JobCardActionIconSvg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrint(jobCard)}
                            className="jc-list-action-btn jc-list-action-btn--print jc-list-action-btn--icon"
                            disabled={isCancelled}
                            title="Print"
                            aria-label="Print"
                          >
                            <JobCardActionIconSvg>
                              <polyline points="6 9 6 2 18 2 18 9" />
                              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                              <rect x="6" y="14" width="12" height="8" />
                            </JobCardActionIconSvg>
                          </button>
                        </div>
                        <div className="job-card-list-action-row">
                          <button
                            type="button"
                            onClick={() => setExpensePopupJob(jobCard)}
                            className="jc-list-action-btn jc-list-action-btn--expenses jc-list-action-btn--icon"
                            disabled={isCancelled}
                            title="Expenses"
                            aria-label="Expenses"
                          >
                            <JobCardActionIconSvg>
                              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                              <path d="M16 10h4" />
                            </JobCardActionIconSvg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRepeat(jobCard)}
                            className="jc-list-action-btn jc-list-action-btn--repeat jc-list-action-btn--icon"
                            disabled={repeatLoadingId != null}
                            title="Create new job card as repeat (same details, new job card number)"
                            aria-label={repeatLoadingId === jobCard.id ? 'Creating repeat job card' : 'Repeat job card'}
                          >
                            {repeatLoadingId === jobCard.id ? (
                              <JobCardActionIconSvg className="jc-list-action-btn__spin">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" fill="none" />
                                <path d="M12 2a10 10 0 0 1 10 10" fill="none" />
                              </JobCardActionIconSvg>
                            ) : (
                              <JobCardActionIconSvg>
                                <polyline points="17 1 21 5 17 9" />
                                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                <polyline points="7 23 3 19 7 15" />
                                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                              </JobCardActionIconSvg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(jobCard)}
                            className="jc-list-action-btn jc-list-action-btn--cancel jc-list-action-btn--icon"
                            disabled={isCancelled}
                            title="Cancel"
                            aria-label="Cancel job card"
                          >
                            <JobCardActionIconSvg>
                              <circle cx="12" cy="12" r="10" />
                              <line x1="15" y1="9" x2="9" y2="15" />
                              <line x1="9" y1="9" x2="15" y2="15" />
                            </JobCardActionIconSvg>
                          </button>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <button
                        type="button"
                        onClick={() => openTaskDetailModal(jobCard)}
                        className="jc-list-action-btn jc-list-action-btn--task-detail jc-list-action-btn--icon"
                        disabled={isCancelled}
                        title="Task detail"
                        aria-label="Task detail"
                      >
                        <JobCardActionIconSvg>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </JobCardActionIconSvg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        {selectedJobCardIds.size > 0 ? (
          <div style={{ padding: '10px 12px', fontSize: 13, color: '#334155', background: '#f1f5f9', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>
                <strong>{selectedJobCardIds.size}</strong> job card{selectedJobCardIds.size === 1 ? '' : 's'} selected
              </span>
              <button
                type="button"
                className="save-btn-modern job-card-outline-btn"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                disabled={schedulePdfLoading}
                onClick={openScheduleModal}
              >
                {schedulePdfLoading ? 'Creating schedule…' : 'Create schedule'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      

      {statusFilteredJobCards.length > pageSize && (
        <div className="list-pagination" style={{ display: 'flex', justifyContent: 'center', marginTop: 16, gap: 8 }}>
          <button 
            className="save-btn-modern" 
            disabled={page === 1} 
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          {Array.from({ length: Math.ceil(statusFilteredJobCards.length / pageSize) }, (_, idx) => (
            <button
              key={idx + 1}
              className={`save-btn-modern${page === idx + 1 ? ' active' : ''}`}
              onClick={() => setPage(idx + 1)}
            >
              {idx + 1}
            </button>
          ))}
          <button 
            className="save-btn-modern" 
            disabled={page === Math.ceil(statusFilteredJobCards.length / pageSize)} 
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {searchTerm && (
        <div style={{ textAlign: 'center', marginTop: '10px', color: '#6B7280' }}>
          Showing {statusFilteredJobCards.length} of {jobCards.length} job cards
        </div>
      )}

      {scheduleModalOpen ? (
        <SchedulePriorityModal
          open={scheduleModalOpen}
          initialJobCards={scheduleModalJobCards}
          onClose={() => {
            if (!schedulePdfLoading) setScheduleModalOpen(false);
          }}
          onPrint={handleScheduleModalPrint}
          onPrioritiesSaved={handleSchedulePrioritiesSaved}
          loading={schedulePdfLoading}
        />
      ) : null}

      {taskDetailJob ? (
        <JobCardTaskDetailModal job={taskDetailJob} onClose={() => setTaskDetailJob(null)} />
      ) : null}

      {draftPopupJob ? (
        <JobCardDraftModal
          jobCard={draftPopupJob}
          printingMachines={printingMachines}
          onClose={() => setDraftPopupJob(null)}
        />
      ) : null}

      {expensePopupJob ? (
        <JobCardExpenseModal
          jobCard={expensePopupJob}
          onClose={() => setExpensePopupJob(null)}
          onSaved={fetchJobCards}
        />
      ) : null}
    </div>
  );
}

export default JobCardList;
