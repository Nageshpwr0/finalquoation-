import React, { useState, useEffect } from 'react';
import JobCardList from './JobCardList';
import '../design-system.css';

const paperOptions = [
  { value: "A4", ups: 8 }, { value: "A5", ups: 16 }, { value: "A6", ups: 32 },
  { value: "Letter", ups: 8 }, { value: "Half-Letter", ups: 16 },
  { value: "7.1x9.5", ups: 16 }, { value: "7.1x4.75", ups: 32 },
  { value: "9.5x13.5", ups: 8 }, { value: "9x9", ups: 12 },
  { value: "8x8", ups: 12 }, { value: "12x12", ups: 4 }, { value: "11x11", ups: 4 }
];

function JobCard({ customers, quotations, onSaved, paperTypes, laminationTypes, initialTab }) {
  const [showList, setShowList] = useState(initialTab === 'add' ? false : true);
  const [editingJobCard, setEditingJobCard] = useState(null);
  const [processRows, setProcessRows] = useState([{
    forms: '',
    sideCount: '',
    qty: '',
    extraSheets: '',
    type: '',
    machine: '',
    lamination: '',
    externalPre: '',
    externalPre2: '',
    punching: '',
    external: '',
    binding: ''
  }]);

  // Task Manager State
  const [taskManager, setTaskManager] = useState({
    cutting: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    printing: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    printing2: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    lamination: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    externalPre: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    punching: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    external: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    binding: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    kappabinding: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' },
    billing: { selected: false, machine: '', amount: '', instructions: '', user: '', wastageAmount: '' }
  });
  const [bookletDataLoaded, setBookletDataLoaded] = useState(false);
  const [processDetailsAutoFilled, setProcessDetailsAutoFilled] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    quotationNumber: '',
    productName: '',
    selectedOptionIndex: '',
    jobName: '',
    jobCardNum: '',
    poNumber: '',
    imageAttached: '',
    billingType: 'cash',
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
    requestPlate: 'NA',
    coverPaperLength: '',
    coverPaperWidth: '',
    coverCutSize: '',
    coverUps: '',
    coverQtyFullSheet: '',
    coverQtyCutSheet: '',
    coverPaperGsm: '',
    coverPaperType: '',
    coverPaperBy: 'us'
  });

  const [availableQuotations, setAvailableQuotations] = useState([]);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [showCoverPaper, setShowCoverPaper] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const getLaminationDisplayName = (laminationValue) => {
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
        'varnish': 'Varnish - ₹0.25',
    };
    return laminationMap[laminationValue] || capitalizeFirstLetter(laminationValue); // Fallback for other types
  };

  const getMachineForProcess = (printingType, cutSize) => {
    if (!printingType || !cutSize) return '';

    const normalizedCutSize = cutSize.toLowerCase();
    const normalizedPrintingType = printingType.toLowerCase();

    // Rule 1: singlecolor and 2+2 color headleberg should select
    if (normalizedPrintingType.includes('single') || normalizedPrintingType.includes('2+2') || normalizedPrintingType.includes('1+1') || normalizedPrintingType.includes('1+0') || normalizedPrintingType.includes('2+0')) {
        return 'Heidelberg';
    }

    // Rule 2: if sheet size 20x28, 20x29.5, 20x30 this then Komori529
    if (normalizedCutSize.includes('20x30') || normalizedCutSize.includes('20x28') || normalizedCutSize.includes('20x29.5')) {
        return 'Komori 529';
    }
    
    // Rule 3: else other size Komori 426
    return 'Komori 426';
  };

  const getFitSheetSizeForBooklet = (pSize, pType) => {
    const isSingleOr2Plus2 = pType === 'single' || pType === '2+2';
    switch(pSize) {
        case 'A4': case 'A5': case 'A6': case '8x8': return '18x25';
        case 'Letter': case 'Half-Letter': case '11x11': return '18x23';
        case '7.1x9.5': case '7.1x4.75': case '9.5x13.5': return isSingleOr2Plus2 ? '15x20' : '20x30';
        case '9x9': return '20x28 or 20x30';
        case '12x12': return '13x26';
        default: return '20x30';
    }
  };

  const handleEdit = (jobCard) => {
    setEditingJobCard(jobCard);
    setShowList(false);
  };

  useEffect(() => {
    // Fetch quotations for the dropdown
    // When editing, include used quotations so the current selection appears
    const includeUsed = editingJobCard ? 'true' : 'false';
    fetch(`/api/quotations?includeUsed=${includeUsed}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          const sortedQuotations = data.data.sort((a, b) => b.serial - a.serial);
          setAvailableQuotations(sortedQuotations);
        }
      })
      .catch(error => {
      });


      
    const bookletProcessData = sessionStorage.getItem('bookletProcessDetails');
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
            paperLength: cutSizeData?.paperLength || '',
            paperWidth: cutSizeData?.paperWidth || '',
          };
        }

        // If booklet cover exists, compute cover paper mapping from Fit Details logic
        if (resultInputs.coverGsm && parseInt(resultInputs.coverGsm) > 0) {
          const paperSize = resultInputs.size || inputs.paperSize;
          const bookletSelected = paperOptions.find(p => p.value === paperSize);
          const bookletUps = bookletSelected?.ups || 1;
          const qty = parseInt(resultInputs.qty || inputs.qty1 || 0);
          const coverWastage = (qty / 2) <= 2100 ? 100 : (qty / 2) <= 4000 ? 150 : (qty / 2) <= 5000 ? 200 : (qty / 2) <= 9000 ? 250 : (qty / 2) <= 15000 ? 350 : 500;
          const coverCutSize = getFitSheetSizeForBooklet(paperSize, resultInputs.coverPrintingColor);
          const coverCutMap = getCutSizeToSheetMapping(coverCutSize);
          const coverQtyCutSheet = Math.ceil((qty * 4) / bookletUps + coverWastage);
          const coverUps = coverCutMap?.ups || 1;
          const coverQtyFullSheet = Math.ceil(coverQtyCutSheet / coverUps);

          newFormData = {
            ...newFormData,
            coverPaperLength: coverCutMap?.paperLength || '',
            coverPaperWidth: coverCutMap?.paperWidth || '',
            coverCutSize: coverCutSize || '',
            coverUps: coverUps,
            coverQtyCutSheet: coverQtyCutSheet,
            coverQtyFullSheet: coverQtyFullSheet,
            coverPaperGsm: resultInputs.coverGsm || '',
            coverPaperType: resultInputs.paperType || '',
            coverPaperBy: 'us'
          };
          setShowCoverPaper(true);
        }

        setFormData(newFormData);
        setSelectedQuotation(quotationDetails);
        
        if (data.processDetails && data.processDetails.length > 0) {
          const allInnerRows = data.processDetails.flatMap(detail => {
            const machine = getMachineForProcess(resultInputs.printing, detail.fitSheetSize);
            return (detail.formDetails || []).map(formDetail => {
              const qty = Math.ceil(detail.originalQty * formDetail.multiplier);
              const totalSheets = Math.ceil(formDetail.sheets);
              const formType = formDetail.type === 'Full' ? 'frontback' : 'selfback';
              return {
                forms: formType,
                sideCount: '2',
                qty: qty.toString(),
                sheets: totalSheets.toString(),
                extraSheets: detail.extraSheets.toString(),
                type: 'Inner',
                machine: machine,
                lamination: getLaminationDisplayName(detail.lamination),
                externalPre: detail.uvType !== 'none' ? detail.uvType : '',
                externalPre2: detail.foilingType !== 'none' ? detail.foilingType : '',
                punching: '',
                external: detail.dripUpType !== 'none' ? detail.dripUpType : '',
                binding: detail.binding || ''
              };
            });
          });

          const coverRows = [];
          if (resultInputs.coverGsm && parseInt(resultInputs.coverGsm) > 0) {
            const firstDetail = data.processDetails[0];
            const coverPrintingType = resultInputs.coverPrintingColor;
            const coverMachine = getMachineForProcess(coverPrintingType, firstDetail.fitSheetSize);
            const qty = firstDetail.originalQty;
            const bookletUps = firstDetail.ups || 1;
            const coverWastage = (qty / 2) <= 2100 ? 100 : (qty / 2) <= 4000 ? 150 : (qty / 2) <= 5000 ? 200 : (qty / 2) <= 9000 ? 250 : (qty / 2) <= 15000 ? 350 : 500;
            const coverQtyCutSheet = Math.ceil((qty * 4) / bookletUps);
            const totalCoverSheets = coverQtyCutSheet + coverWastage;
            const coverFormType = bookletUps === 4 ? 'frontback' : 'selfback';
            coverRows.push({
              forms: coverFormType,
              sideCount: '2',
              qty: coverQtyCutSheet.toString(),
              sheets: totalCoverSheets.toString(),
              extraSheets: coverWastage.toString(),
              type: 'Cover',
              machine: coverMachine,
              lamination: getLaminationDisplayName(resultInputs.coverLamination),
              externalPre: '',
              externalPre2: '',
              punching: '',
              external: '',
              binding: firstDetail.binding || ''
            });
          }

          const convertedProcessRows = [...allInnerRows, ...coverRows];
          setProcessRows(convertedProcessRows);
          setBookletDataLoaded(true);
          setTimeout(() => setBookletDataLoaded(false), 5000);
        }
        
        sessionStorage.removeItem('bookletProcessDetails');
      } catch (error) {
      }
    }

    if (editingJobCard) {
      setFormData(editingJobCard);
      const processDetails = editingJobCard.processDetails || [];
      const updatedProcessDetails = processDetails.map(process => {
        const qty = parseInt(process.qty || 0);
        const extraSheets = parseInt(process.extraSheets || 0);
        return {
          ...process,
          sheets: (qty + extraSheets).toString()
        };
      });
      setProcessRows(updatedProcessDetails);
    }
  }, [editingJobCard, quotations]);

  useEffect(() => {
    if (!selectedQuotation && !bookletDataLoaded && !editingJobCard) {
        const firstRow = processRows[0];
        const isFirstRowEmpty = firstRow && !firstRow.forms && !firstRow.qty && !firstRow.extraSheets && !firstRow.type;

        if (processRows.length === 1 && isFirstRowEmpty) {
            const { qtyCutSheet, jobColor } = formData;

            if (qtyCutSheet > 0) {
                const newFirstRow = { ...firstRow };

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
                
                newFirstRow.type = 'Main Job';

                const updatedQty = parseInt(newFirstRow.qty || 0);
                const updatedExtraSheets = parseInt(newFirstRow.extraSheets || 0);
                newFirstRow.sheets = (updatedQty + updatedExtraSheets).toString();

                setProcessRows([newFirstRow]);
            }
        }
    }
  }, [formData.qtyCutSheet, formData.jobColor, selectedQuotation, bookletDataLoaded, processRows, editingJobCard]);

  const getCutSizeToSheetMapping = (cutSize) => {
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
      '13.5x17': { paperLength: 17, paperWidth: 27, ups: 2 }
    };
    return cutSizeToSheet[cutSize] || null;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: value
    };
    
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
      const coverUps = name === 'coverUps' ? (parseInt(value) || 0) : (parseInt(newFormData.coverUps) || 0);
      const coverQtyFullSheet = name === 'coverQtyFullSheet' ? (parseInt(value) || 0) : (parseInt(formData.coverQtyFullSheet) || 0);
      newFormData.coverQtyCutSheet = coverUps * coverQtyFullSheet;
    }

    if (name === 'ups' || name === 'qtyFullSheet') {
      const ups = name === 'ups' ? parseInt(value) || 0 : parseInt(newFormData.ups) || 0;
      const qtyFullSheet = name === 'qtyFullSheet' ? parseInt(value) || 0 : parseInt(formData.qtyFullSheet) || 0;
      newFormData.qtyCutSheet = ups * qtyFullSheet;
    }
    
    setFormData(newFormData);
  };

  const addProcessRow = () => {
    setProcessRows([...processRows, {
      forms: '', sideCount: '', qty: '', extraSheets: '', type: '', machine: '',
      lamination: '', externalPre: '', externalPre2: '', punching: '', external: '', binding: ''
    }]);
  };

  const updateProcessRow = (index, field, value) => {
    const updatedRows = [...processRows];
    updatedRows[index][field] = value;

    if (field === 'qty' || field === 'extraSheets') {
      const qty = parseInt(updatedRows[index].qty || 0);
      const extraSheets = parseInt(updatedRows[index].extraSheets || 0);
      updatedRows[index].sheets = (qty + extraSheets).toString();
    }

    setProcessRows(updatedRows);
  };

  // Task Manager Functions
  const updateTaskManager = (taskName, field, value) => {
    setTaskManager(prev => ({
      ...prev,
      [taskName]: {
        ...prev[taskName],
        [field]: value
      }
    }));
  };

  const toggleTaskSelection = (taskName) => {
    setTaskManager(prev => ({
      ...prev,
      [taskName]: {
        ...prev[taskName],
        selected: !prev[taskName].selected
      }
    }));
  };

  const autoSelectTasks = () => {
    const newTaskManager = { ...taskManager };
    
    // Reset all tasks first
    Object.keys(newTaskManager).forEach(taskName => {
      newTaskManager[taskName] = {
        ...newTaskManager[taskName],
        selected: false,
        amount: '',
        machine: ''
      };
    });

    // Always select cutting (paper usage) and billing
    newTaskManager.cutting.selected = true;
    newTaskManager.cutting.machine = 'MACHINE 1';
    
    // Calculate cutting amount using formula: Paper Full Size (L* W) * Gsm/3100*paper rate per kg /500* Sheet Qty (Full Sheet) + Same calculation in Cover paper Amt
    let cuttingAmount = 0;
    
    // Main paper calculation - get rate from quotation data
    const quotationRate = formData.quotationDetails?.inputs?.rate || selectedQuotation?.inputs?.rate || 0;
    if (formData.paperLength && formData.paperWidth && formData.paperGsm && quotationRate && formData.qtyFullSheet) {
      const paperLength = parseFloat(formData.paperLength) || 0;
      const paperWidth = parseFloat(formData.paperWidth) || 0;
      const gsm = parseFloat(formData.paperGsm) || 0;
      const paperRate = parseFloat(quotationRate) || 0;
      const sheetQty = parseFloat(formData.qtyFullSheet) || 0;
      
      // Formula: (L * W * GSM / 3100 * paper rate per kg / 500) * Sheet Qty
      const mainPaperCost = (paperLength * paperWidth * gsm / 3100 * paperRate / 500) * sheetQty;
      cuttingAmount += mainPaperCost;
    }
    
    // Cover paper calculation (if exists) - use same quotation rate
    if (formData.coverPaperLength && formData.coverPaperWidth && formData.coverPaperGsm && quotationRate && formData.coverQtyFullSheet) {
      const coverLength = parseFloat(formData.coverPaperLength) || 0;
      const coverWidth = parseFloat(formData.coverPaperWidth) || 0;
      const coverGsm = parseFloat(formData.coverPaperGsm) || 0;
      const coverRate = parseFloat(quotationRate) || 0;
      const coverQty = parseFloat(formData.coverQtyFullSheet) || 0;
      
      // Same formula for cover paper
      const coverPaperCost = (coverLength * coverWidth * coverGsm / 3100 * coverRate / 500) * coverQty;
      cuttingAmount += coverPaperCost;
    }
    
    newTaskManager.cutting.amount = cuttingAmount.toFixed(2);
    
    newTaskManager.billing.selected = true;
    newTaskManager.billing.machine = 'INTERNAL';
    newTaskManager.billing.amount = '1';

    // Auto-select printing based on machine selection in process rows
    let totalPrintingAmount = 0;
    let totalPrinting2Amount = 0;
    let printingMachine = '';
    let printing2Machine = '';
    
    processRows.forEach(row => {
      if (row.machine) {
        const qty = parseInt(row.qty) || 0;
        const formCount = parseInt(row.sideCount) || 1;
        let printingAmount = 0;
        
        // Get machine-specific base rates
        let impressionCost = 400;
        let baseCost = 1600;
        
        if (row.machine.toLowerCase().includes('komori 529')) {
          impressionCost = 500;
          baseCost = 2200;
        } else if (row.machine.toLowerCase().includes('heidelberg')) {
          impressionCost = 150;
          baseCost = 450;
        }
        
        // Calculate printing amount based on forms type
        if (row.forms) {
          const rounds = Math.ceil(qty / 1000);
          const rounds2 = Math.ceil((qty * 2) / 1000);
          
          switch (row.forms.toLowerCase()) {
            case 'frontback':
              printingAmount = (rounds * impressionCost + baseCost) * 2 * formCount;
              break;
            case 'selfback':
            case 'double_gripper':
            case 'doublegripper':
              printingAmount = (rounds2 * impressionCost + baseCost) * formCount;
              break;
            case 'oneside':
              printingAmount = (rounds * impressionCost + baseCost) * formCount;
              break;
            default:
              printingAmount = qty;
              break;
          }
        } else {
          printingAmount = qty;
        }
        
        // Accumulate amounts for each machine type
        if (row.machine.toLowerCase().includes('komori')) {
          totalPrintingAmount += printingAmount;
          printingMachine = row.machine.toUpperCase();
        } else if (row.machine.toLowerCase().includes('heidelberg')) {
          totalPrinting2Amount += printingAmount;
          printing2Machine = 'HEIDELBERG';
        }
      }
    });
    
    // Set the accumulated amounts to task manager
    if (totalPrintingAmount > 0) {
      newTaskManager.printing.selected = true;
      newTaskManager.printing.machine = printingMachine;
      newTaskManager.printing.amount = totalPrintingAmount.toString();
    }
    
    if (totalPrinting2Amount > 0) {
      newTaskManager.printing2.selected = true;
      newTaskManager.printing2.machine = printing2Machine;
      newTaskManager.printing2.amount = totalPrinting2Amount.toString();
    }

    processRows.forEach(row => {
      // Auto-select lamination if specified
      if (row.lamination && row.lamination.trim() !== '') {
        newTaskManager.lamination.selected = true;
        newTaskManager.lamination.machine = 'MACHINE 1';
        
        // Calculate lamination amount using the new formula
        let laminationAmount = 0;
        
        // Get lamination rate from laminationTypes
        const laminationDisplayName = row.lamination;
        let laminationRate = 0;
        
        // Extract lamination type from display name and find rate
        if (laminationDisplayName.includes('Matt')) {
          const mattLamination = laminationTypes.find(lam => lam.laminationName && lam.laminationName.toLowerCase().includes('matt'));
          laminationRate = mattLamination ? mattLamination.rate : 0;
        } else if (laminationDisplayName.includes('Gloss')) {
          const glossLamination = laminationTypes.find(lam => lam.laminationName && lam.laminationName.toLowerCase().includes('gloss'));
          laminationRate = glossLamination ? glossLamination.rate : 0;
        } else if (laminationDisplayName.includes('Thermal')) {
          laminationRate = 0.85; // From the display name mapping
        } else if (laminationDisplayName.includes('Velvet')) {
          laminationRate = 3; // From the display name mapping
        } else if (laminationDisplayName.includes('Varnish')) {
          laminationRate = 0.25; // From the display name mapping
        }
        
        if (laminationRate > 0) {
          const qty = parseInt(row.qty) || 0;
          const extraSheets = parseInt(row.extraSheets) || 0;
          const formCount = parseInt(row.sideCount) || 1;
          
          // Calculate total sheet = (qty + wastage sheet) * form count
          const totalSheet = (qty + extraSheets) * formCount;
          
          // Get Cover Cut Size area
          let coverCutSizeArea = 0;
          
          if (row.type === 'Cover') {
            // For cover rows, use cover paper dimensions
            const coverLength = parseFloat(formData.coverPaperLength) || 0;
            const coverWidth = parseFloat(formData.coverPaperWidth) || 0;
            coverCutSizeArea = coverLength * coverWidth;
          } else {
            // For inner rows, use main paper dimensions
            const paperLength = parseFloat(formData.paperLength) || 0;
            const paperWidth = parseFloat(formData.paperWidth) || 0;
            coverCutSizeArea = paperLength * paperWidth;
          }
          
          // Formula: Cover Cut Size area * totalsheet * lamination rate / 100
          laminationAmount = (coverCutSizeArea * totalSheet * laminationRate) / 100;
        }
        
        newTaskManager.lamination.amount = laminationAmount.toFixed(2);
      }
      
      // Auto-select external pre if specified
      if (row.externalPre && row.externalPre.trim() !== '') {
        newTaskManager.externalPre.selected = true;
        newTaskManager.externalPre.machine = 'MACHINE 1';
        newTaskManager.externalPre.amount = row.qty || '';
      }
      
      // Auto-select punching if specified
      if (row.punching && row.punching.trim() !== '') {
        newTaskManager.punching.selected = true;
        newTaskManager.punching.machine = 'MACHINE 1';
        newTaskManager.punching.amount = row.qty || '';
      }
      
      // Auto-select external if specified
      if (row.external && row.external.trim() !== '') {
        newTaskManager.external.selected = true;
        newTaskManager.external.machine = 'MACHINE 1';
        newTaskManager.external.amount = row.qty || '';
      }
      
      // Auto-select binding if specified
      if (row.binding && row.binding.trim() !== '') {
        newTaskManager.binding.selected = true;
        newTaskManager.binding.machine = 'INTERNAL';
        newTaskManager.binding.amount = row.qty || '';
      }
    });

    setTaskManager(newTaskManager);
  };

  const removeProcessRow = (index) => {
    if (processRows.length > 1) {
      const updatedRows = processRows.filter((_, i) => i !== index);
      setProcessRows(updatedRows);
    }
  };

  const getProcessDetailsFromQuotationData = (quotation, optionIndex = 0) => {
    const inputs = quotation.inputs || {};
    const results = quotation.results || [];
    const productType = quotation.productType;
    
    let processRows = [];
    
    if (productType === 'CutToSheet' && results.length > 0) {
      const result = results[optionIndex] || results[0];
      const bestFit = result.bestFitDetails || {};
      const runDetails = bestFit.runDetails || [];
      
      runDetails.forEach(run => {
          let forms = run.method === 'frontback' ? 'frontback' : run.method === 'selfback' ? 'selfback' : run.method === 'doublegripper' ? 'double_gripper' : 'oneside';
          const formCount = run.method === 'frontback' ? 2 : 1;

          processRows.push({
            forms: forms,
            sideCount: formCount.toString(),
            qty: run.sheetsNeeded ? run.sheetsNeeded.toString() : '0',
            sheets: ((parseInt(run.sheetsNeeded, 10) || 0) + (parseInt(run.wastage, 10) || 0)).toString(),
            extraSheets: run.wastage ? run.wastage.toString() : '0',
            type: 'Main Job',
            machine: getMachineForProcess(inputs.printingType, bestFit.sheet ? `${bestFit.sheet.width}x${bestFit.sheet.height}`: ''),
            lamination: inputs.lamination && inputs.lamination !== 'none' ? inputs.lamination : '', // Auto-select lamination from quotation
            externalPre: inputs.additionalProcess && inputs.additionalProcess !== '0' ? inputs.additionalProcess : '',
            externalPre2: inputs.additionalProcess2 && inputs.additionalProcess2 !== '0' ? inputs.additionalProcess2 : '',
            punching: inputs.punching === 'yes' ? 'yes' : '',
            external: inputs.dieType && inputs.dieType !== '0' ? 'die' : '',
            binding: inputs.fabrication && inputs.fabrication !== '0' ? inputs.fabrication : ''
          });
        });
    } else if (productType === 'Booklet' && results.length > 0) {
      const firstResult = results[optionIndex] || results[0];
       const resultInputs = firstResult.inputs || inputs;
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
                        totalSheets: 0,
                    };
                }
                acc[formType].formCount++;
                acc[formType].totalSheets += Math.ceil(form.sheets);
                return acc;
            }, {});

            const results = [];
            Object.keys(grouped).forEach(formType => {
                const group = grouped[formType];
                const formsOfType = formDetails
                  .filter(form => (form.type === 'Full' ? 'frontback' : 'selfback') === formType);
                
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
                                type: formType === 'selfback' ? 'Cover' : 'Inner',
                                machine: machine,
                                lamination: getLaminationDisplayName(resultInputs.lamination),
                                externalPre: resultInputs.uvType && resultInputs.uvType !== 'none' ? resultInputs.uvType : '',
                                externalPre2: resultInputs.foilingType && resultInputs.foilingType !== 'none' ? resultInputs.foilingType : '',
                                punching: '',
                                external: resultInputs.dripUpType && resultInputs.dripUpType !== 'none' ? resultInputs.dripUpType : '',
                                binding: resultInputs.bindingType || ''
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
                    type: formType === 'selfback' ? 'Cover' : 'Inner',
                    machine: machine,
                    lamination: getLaminationDisplayName(resultInputs.lamination),
                    externalPre: resultInputs.uvType && resultInputs.uvType !== 'none' ? resultInputs.uvType : '',
                    externalPre2: resultInputs.foilingType && resultInputs.foilingType !== 'none' ? resultInputs.foilingType : '',
                    punching: '',
                    external: resultInputs.dripUpType && resultInputs.dripUpType !== 'none' ? resultInputs.dripUpType : '',
                    binding: resultInputs.bindingType || ''
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
            const bookletUps = bookletSelected?.ups || 1;
            const qty = parseInt(firstResult.qty || 0);
            const coverWastage = (qty / 2) <= 2100 ? 100 : (qty / 2) <= 4000 ? 150 : (qty / 2) <= 5000 ? 200 : (qty / 2) <= 9000 ? 250 : (qty / 2) <= 15000 ? 350 : 500;
            const coverQtyCutSheet = Math.ceil((qty * 4) / bookletUps);
            const totalCoverSheets = coverQtyCutSheet + coverWastage;
            const coverFormType = bookletUps === 4 ? 'frontback' : 'selfback';

            processRows.push({
                forms: coverFormType,
                sideCount: '1', // Cover is typically a single form
                qty: coverQtyCutSheet.toString(),
                sheets: totalCoverSheets.toString(),
                extraSheets: coverWastage.toString(),
                type: 'Cover',
                machine: coverMachine,
                lamination: getLaminationDisplayName(resultInputs.coverLamination),
                externalPre: '',
                externalPre2: '',
                punching: '',
                external: '',
                binding: resultInputs.bindingType || ''
            });
        }
    }
    
    return processRows.length > 0 ? processRows : [{
      forms: '', sideCount: '', qty: '', extraSheets: '', type: '', machine: '',
      lamination: '', externalPre: '', externalPre2: '', punching: '', external: '', binding: ''
    }];
  };

  const autoFillFromSelectedOption = (selectedOption, quotation, optionIndex) => {
    const inputs = selectedOption.inputs || quotation.inputs || {};
    const results = quotation.results || [];
    const bestFit = selectedOption.bestFitDetails || null;
    
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
    
    if (quotation.productType === 'CutToSheet' && bestFit?.sheet) {
      sheetSize = `${bestFit.sheet.width}x${bestFit.sheet.height}`;
      totalSheets = bestFit.grandTotalSheets || 0;
      const cutSizeData = getCutSizeToSheetMapping(sheetSize);
      jobUps = cutSizeData ? cutSizeData.ups : (bestFit.ups || 1);
      paperGsm = inputs.gsm || '';
      paperType = inputs.paperType || '';
      jobColor = inputs.printingType || '';
    } else if (quotation.productType === 'Booklet') {
      const resultInputs = inputs;
      const paperSize = resultInputs.size || resultInputs.paperSize;
      const printingType = resultInputs.printing || resultInputs.printingType;
      
      sheetSize = getFitSheetSizeForBooklet(paperSize, printingType);
      
      const pages = parseInt(resultInputs.pages || 0);
      const qty = parseInt(resultInputs.qty || resultInputs.qty1 || 0);
      const selectedPaperOption = paperOptions.find(p => p.value === paperSize);
      const bookletUps = selectedPaperOption?.ups || 1;
      
      totalSheets = Math.ceil((qty + 100) * pages / bookletUps);
      
      const cutSizeData = getCutSizeToSheetMapping(sheetSize);
      jobUps = cutSizeData ? cutSizeData.ups : 1;
      
      paperGsm = resultInputs.gsm || '';
      paperType = resultInputs.paperType || '';
      jobColor = resultInputs.printing || resultInputs.printingType || '';
      
      setShowCoverPaper(true);
    }
    
    const cutSizeData = getCutSizeToSheetMapping(sheetSize);
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
      coverPaperBy: 'us'
    };

    if (quotation.productType === 'Booklet') {
      const resultInputs = inputs;
      const paperSize = resultInputs.size || resultInputs.paperSize;
      const bookletSelected = paperOptions.find(p => p.value === paperSize);
      const bookletUps = bookletSelected?.ups || 1;
      const qty = parseInt(resultInputs.qty || resultInputs.qty1 || 0);
      const coverWastage = (qty / 2) <= 2100 ? 100 : (qty / 2) <= 4000 ? 150 : (qty / 2) <= 5000 ? 200 : (qty / 2) <= 9000 ? 250 : (qty / 2) <= 15000 ? 350 : 500;
      const coverCutSize = getFitSheetSizeForBooklet(paperSize, resultInputs.coverPrintingColor);
      const coverCutMap = getCutSizeToSheetMapping(coverCutSize);
      const coverUps = coverCutMap?.ups || 1;
      const coverQtyCutSheet = Math.ceil((qty * 4) / bookletUps + coverWastage);
      const coverQtyFullSheet = Math.ceil(coverQtyCutSheet / coverUps);

      coverPaperData = {
        coverPaperLength: coverCutMap?.paperLength || '',
        coverPaperWidth: coverCutMap?.paperWidth || '',
        coverCutSize: coverCutSize || '',
        coverUps: coverUps,
        coverQtyCutSheet: coverQtyCutSheet,
        coverQtyFullSheet: coverQtyFullSheet,
        coverPaperGsm: resultInputs.coverGsm || '',
        coverPaperType: resultInputs.paperType || '',
        coverPaperBy: 'us'
      };
      setShowCoverPaper(true);
    }
    
    setFormData(prev => ({
      ...prev,
      paperGsm: paperGsm,
      paperType: paperType,
      cutSize: sheetSize,
      ups: jobUps,
      qtyFullSheet: qtyFullSheet,
      qtyCutSheet: totalSheets,
      paperLength: cutSizeData?.paperLength || '',
      paperWidth: cutSizeData?.paperWidth || '',
      jobColor: jobColor,
      ...coverPaperData
    }));
  };

  const handleOptionSelect = (e) => {
    const optionIndex = e.target.value;
    setFormData(prev => ({
      ...prev,
      selectedOptionIndex: optionIndex
    }));

    if (optionIndex !== '' && selectedQuotation) {
      const selectedOption = quotationOptions[parseInt(optionIndex)];
      if (selectedOption) {
        // Auto-fill job card fields based on selected option
        autoFillFromSelectedOption(selectedOption, selectedQuotation, parseInt(optionIndex));
      }
    }
  };

  const handleQuotationSelect = (e) => {
    const quotationSerial = e.target.value;
    setFormData(prev => ({
      ...prev,
      quotationNumber: quotationSerial,
      selectedOptionIndex: '', // Reset option selection
      productName: '' // Reset product name
    }));

    if (quotationSerial) {
      const quotation = availableQuotations.find(q => q.serial.toString() === quotationSerial);
      if (quotation) {
        setSelectedQuotation(quotation);
        
        // Set quotation options from results array
        // Store quotation details in form data for later use
        setFormData(prev => ({
          ...prev,
          quotationDetails: quotation
        }));
        const inputs = quotation.inputs || {};
        const quotationResults = quotation.results || [];
        setQuotationOptions(quotationResults);
        const bestFit = Array.isArray(quotationResults) && quotationResults.length > 0 ? quotationResults[0].bestFitDetails : null;
        
        // Don't auto-fill process details here, wait for option selection
         // Process details will be filled when user selects an option
        
        let sheetSize = '';
        let totalSheets = 0;
        let jobUps = 1;
        let paperGsm = '';
        let paperType = '';
        let jobColor = '';
        
        if (quotation.productType === 'CutToSheet' && bestFit?.sheet) {
          sheetSize = `${bestFit.sheet.width}x${bestFit.sheet.height}`;
          totalSheets = bestFit.grandTotalSheets || 0;
          const cutSizeData = getCutSizeToSheetMapping(sheetSize);
          jobUps = cutSizeData ? cutSizeData.ups : (bestFit.ups || 1);
          paperGsm = inputs.gsm || '';
          paperType = inputs.paperType || '';
          jobColor = inputs.printingType || '';
        } else if (quotation.productType === 'Booklet') {
          const firstResult = quotationResults.length > 0 ? quotationResults[0] : {};
          const resultInputs = firstResult.inputs || inputs;
          const paperSize = resultInputs.size || inputs.paperSize;
          const printingType = resultInputs.printing || inputs.printingType;
          
          sheetSize = getFitSheetSizeForBooklet(paperSize, printingType);
          
          const pages = parseInt(resultInputs.pages || inputs.pages || 0);
          const qty = parseInt(resultInputs.qty || inputs.qty1 || 0);
          const selectedPaperOption = paperOptions.find(p => p.value === paperSize);
          const bookletUps = selectedPaperOption?.ups || 1;
          
          totalSheets = Math.ceil((qty + 100) * pages / bookletUps); // Simplified wastage for now
          
          const cutSizeData = getCutSizeToSheetMapping(sheetSize);
          jobUps = cutSizeData ? cutSizeData.ups : (firstResult.ups || 1);
          
          paperGsm = resultInputs.gsm || inputs.gsm || '';
          paperType = resultInputs.paperType || inputs.paperType || '';
          jobColor = resultInputs.printing || inputs.printingType || '';
          
          setShowCoverPaper(true);
        }
        
        const cutSizeData = getCutSizeToSheetMapping(sheetSize);
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
          coverPaperBy: 'us'
        };

        if (quotation.productType === 'Booklet') {
          const firstResult = quotationResults.length > 0 ? quotationResults[0] : {};
          const resultInputs = firstResult.inputs || inputs;

          const paperSize = resultInputs.size || inputs.paperSize;
          const bookletSelected = paperOptions.find(p => p.value === paperSize);
          const bookletUps = bookletSelected?.ups || 1;
          const qty = parseInt(resultInputs.qty || inputs.qty1 || 0);
          const coverWastage = (qty / 2) <= 2100 ? 100 : (qty / 2) <= 4000 ? 150 : (qty / 2) <= 5000 ? 200 : (qty / 2) <= 9000 ? 250 : (qty / 2) <= 15000 ? 350 : 500;
          const coverCutSize = getFitSheetSizeForBooklet(paperSize, resultInputs.coverPrintingColor);
          const coverCutMap = getCutSizeToSheetMapping(coverCutSize);
          const coverUps = coverCutMap?.ups || 1;
          const coverQtyCutSheet = Math.ceil((qty * 4) / bookletUps + coverWastage);
          const coverQtyFullSheet = Math.ceil(coverQtyCutSheet / coverUps);

          coverPaperData = {
            coverPaperLength: coverCutMap?.paperLength || '',
            coverPaperWidth: coverCutMap?.paperWidth || '',
            coverCutSize: coverCutSize || '',
            coverUps: coverUps,
            coverQtyCutSheet: coverQtyCutSheet,
            coverQtyFullSheet: coverQtyFullSheet,
            coverPaperGsm: resultInputs.coverGsm || '',
            coverPaperType: resultInputs.paperType || '',
            coverPaperBy: 'us'
          };
          setShowCoverPaper(true);
        }
        
        // Only set basic quotation info, wait for option selection for detailed auto-fill
        setFormData(prev => ({
          ...prev,
          customerName: quotation.customerName || '',
          productName: quotation.productType || ''
        }));
      }
    } else {
      setSelectedQuotation(null);
      setQuotationOptions([]);
      setProcessRows([{
        forms: '', sideCount: '', qty: '', extraSheets: '', type: '', machine: '',
        lamination: '', externalPre: '', externalPre2: '', punching: '', external: '', binding: ''
      }]);
      setProcessDetailsAutoFilled(false);
      setShowCoverPaper(false);
    }
  };

  const handleSubmit = async (e) => {
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
    
    try {
      const jobCardData = {
        ...formData,
        processDetails: processRows,
        taskManager: taskManager,
        quotationDetails: selectedQuotation ? JSON.stringify(selectedQuotation) : null
      };
      
      const isEditing = Boolean(editingJobCard && editingJobCard.id);
      const url = isEditing ? `/api/jobcards/${editingJobCard.id}` : `/api/jobcards`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobCardData),
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
          alert(`Job Card created successfully! Job Card Number: ${data.data?.jobCardNum || data.jobCardNum}`);
        }
        
        // Refresh available quotations to remove the used one
        if (formData.quotationNumber) {
          fetch('/api/quotations?includeUsed=false')
            .then(res => res.json())
            .then(quotData => {
              if (quotData && quotData.data) {
                const sortedQuotations = quotData.data.sort((a, b) => b.serial - a.serial);
                setAvailableQuotations(sortedQuotations);
              }
            })
            .catch(error => {
            });
        }
        
        setFormData({
          customerName: '',
          quotationNumber: '',
          productName: '',
          jobName: '',
          jobCardNum: '',
          poNumber: '',
          imageAttached: '',
          imageData: '',
          billingType: 'cash',
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
          requestPlate: 'NA',
          coverPaperLength: '',
          coverPaperWidth: '',
          coverCutSize: '',
          coverUps: '',
          coverQtyFullSheet: '',
          coverQtyCutSheet: '',
          coverPaperGsm: '',
          coverPaperType: '',
          coverPaperBy: 'us'
        });
        setShowCoverPaper(false);
        setSelectedQuotation(null);
        setProcessRows([{
          forms: '', sideCount: '', qty: '', extraSheets: '', type: '', machine: '',
          lamination: '', externalPre: '', externalPre2: '', punching: '', external: '', binding: ''
        }]);
        setShowList(true);
        setRefreshTrigger(Date.now());
      } else {
        alert(`Error creating job card: ${data.error || data.message || 'Unknown server error'}`);
      }
    } catch (error) {
      alert(`Error creating job card: ${error.message}`);
    }
  };

  return (
    <div className="form-container-modern">
      {/* Main container with tab buttons on the left */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '20px' }}>
          <button 
            onClick={() => setShowList(false)}
            style={{
              padding: '10px 20px',
              border: '1px solid #DB7093',
              borderRight: 'none',
              borderRadius: '6px 0 0 6px',
              backgroundColor: !showList ? '#DB7093' : '#FFFFFF',
              color: !showList ? '#FFFFFF' : '#DB7093',
              cursor: !showList ? 'default' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
            disabled={!showList}
          >
            Add Job Card
          </button>
          <button 
            onClick={() => setShowList(true)}
            style={{
              padding: '10px 20px',
              border: '1px solid #DB7093',
              borderRadius: '0 6px 6px 0',
              backgroundColor: showList ? '#DB7093' : '#FFFFFF',
              color: showList ? '#FFFFFF' : '#DB7093',
              cursor: showList ? 'default' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
            disabled={showList}
          >
            Edit Job Card
          </button>
        </div>
      </div>

      {/* Content area */}
      {showList ? (
        <div>
          <JobCardList refreshTrigger={refreshTrigger} onEdit={handleEdit} laminationTypes={laminationTypes} />
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
          <div className="form-grid-modern">
          <div className="form-group-modern col-span-3">
            <label className="form-label-modern">Customer *</label>
            <select
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
            </select>
          </div>

          <div className="form-group-modern col-span-1">
            <label className="form-label-modern">
              Quotation (Auto-fill)
              <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 'normal', display: 'block' }}>
                {editingJobCard ? 'Includes used quotations while editing' : 'Only unused quotations shown'}
              </span>
            </label>
            <select
              name="quotationNumber"
              value={formData.quotationNumber}
              onChange={handleQuotationSelect}
              className="input-field-modern"
              title="Select a quotation to auto-fill process details (only unused quotations shown)"
            >
              <option value="">Select Quotation</option>
              {availableQuotations.map((quotation) => (
                <option key={quotation.id} value={quotation.serial}>
                  #{quotation.serial} - {quotation.productType} - {quotation.customerName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">{selectedQuotation ? 'Option Number *' : 'Product Name *'}</label>
            <select
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
                  <option value="CutToSheet">CutToSheet</option>
                  <option value="Booklet">Booklet</option>
                  <option value="Poster">Poster</option>
                  <option value="Envelope">Envelope</option>
                  <option value="Bag">Bag</option>
                  <option value="Calendar">Calendar</option>
                </>
              )}
            </select>
          </div>

          <div className="form-group-modern col-span-2">
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
            <label className="form-label-modern">Job Card Number</label>
            <input
              type="text"
              name="jobCardNum"
              value={formData.jobCardNum || 'Auto'}
              className="input-field-modern"
              disabled
            />
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

          <div className="form-group-modern col-span-1">
            <label className="form-label-modern">Billing Type *</label>
            <select
              name="billingType"
              value={formData.billingType}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="cash">Cash</option>
              <option value="billing">Billing</option>
            </select>
          </div>

          <div className="form-group-modern col-span-1">
            <label className="form-label-modern">Sample Attached *</label>
            <select
              name="sampleAttached"
              value={formData.sampleAttached}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          </div>
        </div>



        <div className="job-card-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="section-title">Main Paper Details</h3>
            <button 
              type="button" 
              onClick={() => setShowCoverPaper(!showCoverPaper)}
              className="save-btn-modern"
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
              <select
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
              </select>
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
                <select
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
                </select>
              </div>
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
              <label className="form-label-modern">Sheet Qty (Full Sheet)</label>
              <input
                type="number"
                name="qtyFullSheet"
                value={formData.qtyFullSheet}
                onChange={handleInputChange}
                className="input-field-modern"
                placeholder="Enter quantity"
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">Paper By</label>
              <select
                name="paperBy"
                value={formData.paperBy}
                onChange={handleInputChange}
                className="input-field-modern"
                required
              >
                <option value="us">Us</option>
                <option value="party">Party</option>
              </select>
            </div>
          </div>
          

          
          {showCoverPaper && (
            <>
              <h4 className="section-title" style={{ marginTop: '20px', fontSize: '1.1rem' }}>Cover Paper Details</h4>
              <div className="paper-grid-9">
                <div className="form-group-modern col-span-1">
                  <label className="form-label-modern">Cover Paper Length</label>
                  <input type="number" name="coverPaperLength" value={formData.coverPaperLength} onChange={handleInputChange} className="input-field-modern" step="0.01" />
                </div>
                <div className="form-group-modern col-span-1">
                  <label className="form-label-modern">Cover Paper Width</label>
                  <input type="number" name="coverPaperWidth" value={formData.coverPaperWidth} onChange={handleInputChange} className="input-field-modern" step="0.01" />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Cover Cut Size</label>
                  <input type="text" name="coverCutSize" value={formData.coverCutSize} onChange={handleInputChange} className="input-field-modern" />
                </div>
                <div className="form-group-modern col-span-1">
                  <label className="form-label-modern">Cover UPS</label>
                  <select name="coverUps" value={formData.coverUps} onChange={handleInputChange} className="input-field-modern">
                    <option value="">Select UPS</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Cover Qty Full Sheet</label>
                  <input type="number" name="coverQtyFullSheet" value={formData.coverQtyFullSheet} onChange={handleInputChange} className="input-field-modern" />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Cover Qty Cut Sheet</label>
                  <input type="number" name="coverQtyCutSheet" value={formData.coverQtyCutSheet} onChange={handleInputChange} className="input-field-modern" />
                </div>
                <div className="form-group-modern col-span-1">
                  <label className="form-label-modern">Cover Paper GSM</label>
                  <input type="number" name="coverPaperGsm" value={formData.coverPaperGsm} onChange={handleInputChange} className="input-field-modern" />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Cover Paper Type</label>
                  <select name="coverPaperType" value={formData.coverPaperType} onChange={handleInputChange} className="input-field-modern">
                    <option value="">Select Paper Type</option>
                    {paperTypes.map(p => <option key={p.id} value={p.paperTypeName}>{p.paperTypeName}</option>)}
                  </select>
                </div>
                <div className="form-group-modern col-span-1">
                  <label className="form-label-modern">Cover Paper By *</label>
                  <select name="coverPaperBy" value={formData.coverPaperBy} onChange={handleInputChange} className="input-field-modern" required>
                    <option value="us">Us</option>
                    <option value="party">Party</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="job-card-section">
          <h3 className="section-title">Printing Details</h3>
          <div className="form-grid-modern">

          <div className="form-group-modern">
            <label className="form-label-modern">Job Color</label>
            <select
              name="jobColor"
              value={formData.jobColor}
              onChange={handleInputChange}
              className="input-field-modern"
            >
              <option value="">Select Color</option>
              <option value="bothsides">Both Sides (4+4 Color)</option>
              <option value="oneside">One Side (4+0 Color)</option>
              <option value="bothsides2">Both Sides (2+2 Color)</option>
              <option value="oneside2">One Side (2+0 Color)</option>
              <option value="bothsides1">Both Sides (1+1 Color)</option>
              <option value="oneside1">One Side (1+0 Color)</option>
              <option value="pantone_cmyk_bs">Pantone+CMYK B/S</option>
              <option value="pantone_cmyk_os">Pantone+CMYK O/S</option>
              <option value="pantone_bs">Pantone B/S</option>
              <option value="pantone_os">Pantone O/S</option>
              <option value="multi">Multi-Color</option>
              <option value="single">Single Color</option>
              <option value="2+2">2+2 Color</option>
              <option value="common-ruled-4+4">Common or ruled 4+4</option>
              <option value="common-ruled-2+2">Common or ruled 2+2</option>
              <option value="common-ruled-1+1">Common or ruled 1+1</option>
              <option value="common-ruled-4+0">Common or ruled 4+0</option>
              <option value="common-ruled-2+0">Common or ruled 2+0</option>
              <option value="common-ruled-1+0">Common or ruled 1+0</option>
            </select>
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Plate By *</label>
            <select
              name="plateBy"
              value={formData.plateBy}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="us">Us</option>
              <option value="party">Party</option>
            </select>
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Job Type *</label>
            <select
              name="jobType"
              value={formData.jobType}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="new">New</option>
              <option value="old">Old</option>
            </select>
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Priority *</label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="urgent">Urgent</option>
              <option value="most_urgent">Most Urgent</option>
              <option value="regular">Regular</option>
            </select>
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Repeat No</label>
            <input
              type="number"
              name="repeatNo"
              value={formData.repeatNo}
              onChange={handleInputChange}
              className="input-field-modern"
            />
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Request Plate *</label>
            <select
              name="requestPlate"
              value={formData.requestPlate}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="pc2plate">PC2Plate</option>
              <option value="NA">NA</option>
            </select>
          </div>
          </div>
        </div>

        <div className="job-card-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="section-title">
              Process Details 
              {formData.quotationNumber && (
                <span style={{ fontSize: '0.85rem', color: '#6B7280', fontWeight: 'normal' }}>
                  (Auto-filled from {selectedQuotation?.productType || 'Quotation'} #{formData.quotationNumber})
                </span>
              )}
            </h3>
            <button type="button" onClick={addProcessRow} className="save-btn-modern" style={{ fontSize: '18px', padding: '8px 16px' }}>+</button>
          </div>
          
          {processRows.map((row, index) => (
            <div key={index} className="process-row-12" style={{ marginBottom: '16px', padding: '16px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
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
                  <label className="form-label-modern">Forms</label>
                  <select
                    value={row.forms}
                    onChange={(e) => updateProcessRow(index, 'forms', e.target.value)}
                    className="input-field-modern"
                  >
                    <option value="">Select Form</option>
                    <option value="frontback">FrontBack</option>
                    <option value="selfback">Selfback</option>
                    <option value="oneside">One Side</option>
                    <option value="double_gripper">Double Gripper</option>
                  </select>
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
                  <label className="form-label-modern">Type</label>
                  <input
                    type="text"
                    value={row.type}
                    onChange={(e) => updateProcessRow(index, 'type', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Machine *</label>
                  <select
                    value={row.machine}
                    onChange={(e) => updateProcessRow(index, 'machine', e.target.value)}
                    className="input-field-modern"
                    required
                  >
                    <option value="">Select Machine</option>
                    <option value="Komori 426">Komori 426</option>
                    <option value="Komori 529">Komori 529</option>
                    <option value="Heidelberg">Heidelberg</option>
                  </select>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Lamination</label>
                  <select
                    value={row.lamination}
                    onChange={(e) => updateProcessRow(index, 'lamination', e.target.value)}
                    className="input-field-modern"
                  >
                    <option value="">Select Lamination Type</option>
                    {laminationTypes && laminationTypes.map(lamination => (
                      <option key={lamination.id} value={lamination.laminationName}>
                        {lamination.laminationName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">External Pre</label>
                  <input
                    type="text"
                    value={row.externalPre}
                    onChange={(e) => updateProcessRow(index, 'externalPre', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">External Pre-2</label>
                  <input
                    type="text"
                    value={row.externalPre2}
                    onChange={(e) => updateProcessRow(index, 'externalPre2', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Punching</label>
                  <input
                    type="text"
                    value={row.punching}
                    onChange={(e) => updateProcessRow(index, 'punching', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">External</label>
                  <input
                    type="text"
                    value={row.external}
                    onChange={(e) => updateProcessRow(index, 'external', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Binding</label>
                  <input
                    type="text"
                    value={row.binding}
                    onChange={(e) => updateProcessRow(index, 'binding', e.target.value)}
                    className="input-field-modern"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Task Manager Section */}
        <div className="job-card-section">
          <h3 className="section-title" style={{ backgroundColor: '#4A90A4', color: 'white', padding: '10px', margin: '0 0 20px 0', textAlign: 'center', borderRadius: '4px' }}>TASK MANAGER</h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'left', minWidth: '120px' }}>Task</th>
                  <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'left', minWidth: '150px' }}>Machine</th>
                  <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'left', minWidth: '100px' }}>Amount</th>
                  <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'left', minWidth: '200px' }}>Instructions</th>
                  <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'left', minWidth: '100px' }}>User</th>
                  <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'left', minWidth: '120px' }}>Wastage Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(taskManager).map(([taskName, taskData]) => {
                  const taskLabels = {
                    cutting: 'CUTTING',
                    printing: 'PRINTING',
                    printing2: 'PRINTING 2',
                    lamination: 'LAMINATION',
                    externalPre: 'EXTERNAL PRE',
                    punching: 'PUNCHING',
                    external: 'EXTERNAL',
                    binding: 'BINDING',
                    kappabinding: 'KAPPABINDING',
                    billing: 'BILLING'
                  };
                  
                  return (
                    <tr key={taskName}>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={taskData.selected}
                            onChange={() => toggleTaskSelection(taskName)}
                            style={{ transform: 'scale(1.2)' }}
                          />
                          <span style={{ fontWeight: taskData.selected ? 'bold' : 'normal' }}>
                            {taskLabels[taskName]}
                          </span>
                        </div>
                      </td>
                      <td style={{ border: '1px solid #dee2e6', padding: '4px' }}>
                        <select
                          value={taskData.machine}
                          onChange={(e) => updateTaskManager(taskName, 'machine', e.target.value)}
                          disabled={!taskData.selected}
                          style={{ 
                            width: '100%', 
                            padding: '4px', 
                            border: '1px solid #ccc', 
                            borderRadius: '4px',
                            backgroundColor: taskData.selected ? 'white' : '#f5f5f5'
                          }}
                        >
                          <option value="">Select</option>
                          <option value="MACHINE 1">MACHINE 1</option>
                          <option value="KOMORI LS">KOMORI LS</option>
                          <option value="HEIDELBERG">HEIDELBERG</option>
                          <option value="INTERNAL">INTERNAL</option>
                        </select>
                      </td>
                      <td style={{ border: '1px solid #dee2e6', padding: '4px' }}>
                        <input
                          type="number"
                          value={taskData.amount}
                          onChange={(e) => updateTaskManager(taskName, 'amount', e.target.value)}
                          disabled={!taskData.selected}
                          style={{ 
                            width: '100%', 
                            padding: '4px', 
                            border: '1px solid #ccc', 
                            borderRadius: '4px',
                            backgroundColor: taskData.selected ? 'white' : '#f5f5f5'
                          }}
                          placeholder="0"
                        />
                      </td>
                      <td style={{ border: '1px solid #dee2e6', padding: '4px' }}>
                        <input
                          type="text"
                          value={taskData.instructions}
                          onChange={(e) => updateTaskManager(taskName, 'instructions', e.target.value)}
                          disabled={!taskData.selected}
                          style={{ 
                            width: '100%', 
                            padding: '4px', 
                            border: '1px solid #ccc', 
                            borderRadius: '4px',
                            backgroundColor: taskData.selected ? 'white' : '#f5f5f5'
                          }}
                          placeholder="Enter instructions"
                        />
                      </td>
                      <td style={{ border: '1px solid #dee2e6', padding: '4px' }}>
                        <select
                          value={taskData.user}
                          onChange={(e) => updateTaskManager(taskName, 'user', e.target.value)}
                          disabled={!taskData.selected}
                          style={{ 
                            width: '100%', 
                            padding: '4px', 
                            border: '1px solid #ccc', 
                            borderRadius: '4px',
                            backgroundColor: taskData.selected ? 'white' : '#f5f5f5'
                          }}
                        >
                          <option value="">Select</option>
                          <option value="User 1">User 1</option>
                          <option value="User 2">User 2</option>
                          <option value="User 3">User 3</option>
                        </select>
                      </td>
                      <td style={{ border: '1px solid #dee2e6', padding: '4px' }}>
                        <input
                          type="number"
                          value={taskData.wastageAmount}
                          onChange={(e) => updateTaskManager(taskName, 'wastageAmount', e.target.value)}
                          disabled={!taskData.selected}
                          style={{ 
                            width: '100%', 
                            padding: '4px', 
                            border: '1px solid #ccc', 
                            borderRadius: '4px',
                            backgroundColor: taskData.selected ? 'white' : '#f5f5f5'
                          }}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <strong>Total: </strong>
            <span style={{ marginLeft: '10px' }}>
              Selected Tasks: {Object.values(taskManager).filter(task => task.selected).length} / {Object.keys(taskManager).length}
            </span>
          </div>
        </div>

        <div className="form-actions-modern">
          <button 
            type="button" 
            onClick={autoSelectTasks}
            className="save-btn-modern" 
            style={{ marginRight: '10px', backgroundColor: '#28a745', borderColor: '#28a745' }}
          >
            Get Task Amount
          </button>
          <button type="submit" className="save-btn-modern">
            {editingJobCard ? 'Update Job Card' : 'Create Job Card'}
          </button>
        </div>
      </form>

      {selectedQuotation && selectedQuotation.inputs && (
        <div className="job-card-section" style={{ backgroundColor: '#F0F8FF', border: '2px solid #4169E1', marginTop: '20px' }}>
          <h3 className="section-title" style={{ color: '#1E40AF' }}>
            Quotation Input Details (#{selectedQuotation.serial} - {selectedQuotation.productType})
            {formData.selectedOptionIndex !== '' && (
              <span style={{ fontSize: '0.85rem', fontWeight: 'normal' }}> - Option {parseInt(formData.selectedOptionIndex) + 1}</span>
            )}
          </h3>
          <div className="form-grid-modern" style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}>
            {Object.entries(
              selectedQuotation.inputs || {}
            ).map(([key, value]) => {
              // Show all input specifications including zeros and 'none' values for better context
              // Only filter out truly empty values, but keep 'none' and '0' as they represent user selections
              if (value === undefined || value === null || value === '') return null;
              
              const formatLabel = (key) => {
                const labelMap = {
                  customerName: 'Customer',
                  qty: 'Quantity',
                  qty1: 'Quantity',
                  jobWidth: 'Width (mm)',
                  jobHeight: 'Height (mm)',
                  paperSize: 'Paper Size',
                  size: 'Size',
                  gsm: 'GSM',
                  paperType: 'Paper Type',
                  printingType: 'Printing Type',
                  printing: 'Printing',
                  pages: 'Pages',
                  lamination: 'Lamination',
                  bindingType: 'Binding Type',
                  binding: 'Binding',
                  additionalProcess: 'Additional Process',
                  additionalProcess2: 'Additional Process 2',
                  punching: 'Punching',
                  dieType: 'Die Type',
                  rate: 'Rate',
                  amount: 'Amount',
                  totalAmount: 'Total Amount',
                  finalRate: 'Final Rate',
                  none: 'None Selected',
                  '0': 'Not Specified',
                  fabrication: 'Fabrication',
                  fabricationN: 'Fabrication 2',
                  uvType: 'UV Type',
                  foilingType: 'Foiling',
                  dripUpType: 'Drip Up',
                  coverGsm: 'Cover GSM',
                  coverPrintingColor: 'Cover Printing',
                  coverLamination: 'Cover Lamination'
                };
                return labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
              };
              
              const formatValue = (key, value) => {
                // Handle dimensions - show both width and height separately for clarity
                if (key === 'jobWidth') {
                  return `${value}mm`;
                }
                if (key === 'jobHeight') {
                  return `${value}mm`;
                }
                
                // Format special values for better readability
                if (value === 'none') return 'None Selected';
                if (value === '0' || value === 0) return 'Not Specified';
                
                // Format monetary values
                if (typeof value === 'number' && (key.includes('rate') || key.includes('amount') || key.includes('Rate') || key.includes('Amount'))) {
                  return `₹${value.toFixed(2)}`;
                }
                
                return String(value);
              };
              
              const displayValue = formatValue(key, value);
              if (!displayValue) return null;
              
              return (
                <div key={key} className="form-group-modern">
                  <label className="form-label-modern">{formatLabel(key)}</label>
                  <div className="input-field-modern" style={{ backgroundColor: '#E6F3FF', border: 'none' }}>
                    {displayValue}
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
          
          {/* Display selected option's calculated values */}
          {formData.selectedOptionIndex !== '' && quotationOptions[formData.selectedOptionIndex] && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#495057', fontSize: '1rem' }}>Selected Option {parseInt(formData.selectedOptionIndex) + 1} - Calculated Values</h4>
              <div className="form-grid-modern" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {Object.entries(quotationOptions[formData.selectedOptionIndex]).map(([key, value]) => {
                  // Only show calculated values like rate, amount, etc.
                  if (!value || value === 'none' || value === '0' || value === 0) return null;
                  if (!key.toLowerCase().includes('rate') && !key.toLowerCase().includes('amount') && !key.toLowerCase().includes('total') && !key.toLowerCase().includes('final')) return null;
                  
                  const formatLabel = (key) => {
                    const labelMap = {
                      rate: 'Rate',
                      amount: 'Amount', 
                      totalAmount: 'Total Amount',
                      finalRate: 'Final Rate',
                      finalAmount: 'Final Amount'
                    };
                    return labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
                  };
                  
                  const formatValue = (value) => {
                    if (typeof value === 'number') {
                      return `₹${value.toFixed(2)}`;
                    }
                    return String(value);
                  };
                  
                  return (
                    <div key={key} className="form-group-modern">
                      <label className="form-label-modern">{formatLabel(key)}</label>
                      <div className="input-field-modern" style={{ backgroundColor: '#E8F5E8', border: 'none', fontWeight: 'bold' }}>
                        {formatValue(value)}
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          )}
        </div>
      )}    </div>
      )}
    </div>
  );
}

export default JobCard;
