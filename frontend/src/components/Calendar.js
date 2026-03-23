import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../design-system.css';

const Modal = ({ show, onClose, children }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white m-auto p-6 rounded-lg shadow-lg text-center relative w-11/12 max-w-md">
                <button onClick={onClose} className="absolute top-2 right-4 text-gray-500 hover:text-gray-800 text-3xl font-bold">&times;</button>
                {children}
            </div>
        </div>
    );
};

const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
};

const Calendar = ({ formData, onSaved, getNextSerial, customers, paperTypes = [], laminationTypes = [], onAddNewCustomer, apiUrl, onNavigate }) => {
  // State for all form inputs
  const [inputs, setInputs] = useState({
    calendarType: 'patti',
    paperType: '78',
    qty: '',
    noOfLeaves: '1',
    jobWidth: '',
    jobHeight: '',
    gsm: '',
    rate: '78',
    hcut: '',
    wcut: '',
    ups: '',
    printingType: 'bothsides',
    lamination: 'none',
    checkA: false,
    checkB: false,
    checkC: false,
    reelcut: false,
    dieType: '0',
    punching: 'none',
    fabrication: '0',
    fabricationN: '0',
    additionalProcess: '0',
    additionalProcessWidth: '',
    additionalProcessHeight: '',
    additionalProcess2: '0',
    additionalProcess2Width: '',
    additionalProcess2Height: '',
    plainOuterPaper: false,
    ohpSheet: false,
    outerPaperGumming: false,
    customerName: '',

  });

  // State for UI control and results
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [serial, setSerial] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [showHalfCutting, setShowHalfCutting] = useState(false);
  const [showAdditionalProcessInputs, setShowAdditionalProcessInputs] = useState(false);
  const [showAdditionalProcess2Inputs, setShowAdditionalProcess2Inputs] = useState(false);
  const [adjustmentPercentage, setAdjustmentPercentage] = useState(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  const summaryRef = useRef(null);

  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) {
        return customers;
    }
    return customers.filter(customer =>
        customer.customerName.toLowerCase().includes(customerSearchTerm.toLowerCase())
    );
  }, [customers, customerSearchTerm]);

  useEffect(() => {
    if (formData) {
      setInputs(formData.inputs || {});
      setSerial(formData.serial || null);
      setResults(formData.results || []);
    }
  }, [formData]);

  // --- EFFECT HOOKS to handle dependent state changes ---

  // Update rate when paperType changes
  useEffect(() => {
    let newRate;
    if (!isNaN(Number(inputs.paperType))) {
      newRate = inputs.paperType;
    } else if (inputs.paperType === 'hotmailsticker') {
      newRate = 120;
    } else {
      newRate = '';
    }
    setInputs(prev => ({ ...prev, rate: newRate }));
  }, [inputs.paperType]);

  // Handle changes when paperType is 'hotmailsticker'
  useEffect(() => {
    if (inputs.paperType === 'hotmailsticker') {
      setInputs(prev => ({
        ...prev,
        gsm: '80',
        printingType: 'oneside',
        lamination: 'none',
      }));
      setShowHalfCutting(true);
    } else {
      setShowHalfCutting(false);
    }
  }, [inputs.paperType]);
  
    // Toggle visibility of additional process inputs
  useEffect(() => {
    const processesRequiringInputs = ['spotuv', 'raiseduv', 'stampfoil', 'magicfoil', 'spotuvbs', 'raiseduvbs', 'stampfoilbs', 'magicfoilbs'];
    setShowAdditionalProcessInputs(processesRequiringInputs.includes(inputs.additionalProcess));
  }, [inputs.additionalProcess]);

  useEffect(() => {
    const processesRequiringInputs = ['spotuv', 'raiseduv', 'stampfoil', 'magicfoil', 'spotuvbs', 'raiseduvbs', 'stampfoilbs', 'magicfoilbs'];
    setShowAdditionalProcess2Inputs(processesRequiringInputs.includes(inputs.additionalProcess2));
  }, [inputs.additionalProcess2]);


  // --- HELPER FUNCTIONS ---

  const parseInputToInches = (input) => {
    if (!input) return 0;
    input = String(input).trim().toLowerCase();
    if (input.endsWith('mm')) {
      let mmValue = parseFloat(input.replace('mm', ''));
      if (!isNaN(mmValue)) return mmValue / 25.4;
    }
    let inchValue = parseFloat(input);
    return isNaN(inchValue) ? 0 : inchValue;
  };

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setInputs(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleAbcCheck = (checkedId) => {
      setInputs(prev => ({
          ...prev,
          checkA: checkedId === 'checkA' ? !prev.checkA : false,
          checkB: checkedId === 'checkB' ? !prev.checkB : false,
          checkC: checkedId === 'checkC' ? !prev.checkC : false,
      }));
  };

  const copySummary = () => {
    if (summaryRef.current) {
      const summaryText = summaryRef.current.innerText;
      const lines = summaryText.split('\n').filter(line => line.trim() !== '');
      
      let formattedText = '';
      let jobSummaryStarted = false;
      for(const line of lines) {
          if(line.includes('Job Summary')) {
              jobSummaryStarted = true;
              formattedText += line + '\n\n';
          } else if (jobSummaryStarted) {
              if (line.includes('Total Cost:') || line.includes('Final Rate per Piece:')) {
                  formattedText += '\n' + line + '\n';
              } else if (line.includes('Terms & Conditions:')) {
                   formattedText += '\n' + line + '\n';
              } else if (line.startsWith('•')) {
                   formattedText += line + '\n';
              }
              else {
                  formattedText += line.replace(':', ': ') + '\n';
              }
          }
      }
      
      formattedText += '\nDelivery Time: 2-3 Days';
      formattedText += '\nThis rate is valid for 5-7 days.';

      const textarea = document.createElement('textarea');
      textarea.value = formattedText.trim();
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 2000);
      } catch (err) {
        setCopySuccess('Failed to copy');
      }
      document.body.removeChild(textarea);
    }
  };


  // --- CORE CALCULATION LOGIC ---

  const getPrintingCostParams = () => {
    let baseCost = 1600, largeBaseCost = 2200, impressionCost = 400, largeImpressionCost = 500;
    if (inputs.checkA) { baseCost = 1250; largeBaseCost = 1250; } 
    else if (inputs.checkB) { baseCost = 1350; largeBaseCost = 1350; impressionCost = 360; largeImpressionCost = 360; } 
    else if (inputs.checkC) { baseCost = 1700; largeBaseCost = 1700; }
    return { baseCost, largeBaseCost, impressionCost, largeImpressionCost };
  };

  const getBasePrintCost = () => {
    const gsm = parseFloat(inputs.gsm);
    const jobWidth = parseInputToInches(inputs.jobWidth);
    const jobHeight = parseInputToInches(inputs.jobHeight);
    const qty = parseInt(inputs.qty) || 0;
    const noOfLeaves = parseInt(inputs.noOfLeaves) || 1;
    let rate = parseFloat(inputs.rate);

    if (inputs.checkA) rate -= 3;
    if (inputs.checkB) rate -= 2;

    let bestFit = { cost: Infinity, sheet: null, ups: 0, totalPaperCost: 0, totalPrintingCost: 0, totalDripupCost: 0, grandTotalSheets: 0, detailedBreakdownHTML: '', usedWidth: 0, usedHeight: 0, isReelCut: false };

    let fullSheets;
    if (inputs.reelcut) {
        fullSheets = [{ width: 19, height: 25.5, price: 0 }, { width: 20, height: 30, price: 0 }];
    } else if (inputs.paperType === "hotmailsticker") {
        fullSheets = [{ width: 18, height: 25, price: 7.5 }, { width: 18, height: 23, price: 7 }, { width: 15, height: 20, price: 5 }, { width: 20, height: 30, price: 10 }];
    } else {
        fullSheets = [{ width: 18, height: 25 }, { width: 18, height: 23 }, { width: 15, height: 20 }, { width: 20, height: 30 }, { width: 12, height: 23 }, { width: 15, height: 25 }, { width: 12, height: 25 }, { width: 19, height: 25 }, { width: 20, height: 29.5 }, { width: 13, height: 26 }, { width: 14, height: 26 }];
    }

    const bleed = 0.1378;
    const gripper = 0.7;
    const adjustedWidth = jobWidth + bleed;
    const adjustedHeight = jobHeight + bleed;

    if (noOfLeaves > 1) {
        fullSheets.forEach((currentSheet) => {
            const shortSide = Math.min(currentSheet.width, currentSheet.height);
            const longSide = Math.max(currentSheet.width, currentSheet.height);
            const usableShort_sg = shortSide - gripper;
            const ups1 = Math.floor(longSide / adjustedWidth) * Math.floor(usableShort_sg / adjustedHeight);
            const ups2 = Math.floor(longSide / adjustedHeight) * Math.floor(usableShort_sg / adjustedWidth);
            const currentUps = Math.max(ups1, ups2);
            if (currentUps === 0) return;
            const usedWidth = ups1 > ups2 ? Math.floor(longSide / adjustedWidth) * adjustedWidth : Math.floor(longSide / adjustedHeight) * adjustedHeight;
            const usedHeight = ups1 > ups2 ? Math.floor(usableShort_sg / adjustedHeight) * adjustedHeight : Math.floor(usableShort_sg / adjustedWidth) * adjustedWidth;
            const colorType = inputs.printingType.endsWith('1') ? '1' : (inputs.printingType.endsWith('2') ? '2' : '');
            const isBothSides = inputs.printingType.includes('bothsides');
            const isLargeFormatSheet = (currentSheet.width === 20 && (currentSheet.height === 30 || currentSheet.height === 29.5));
            const isSpecialColorJob = inputs.printingType.includes('1') || inputs.printingType.includes('2');
            if (isLargeFormatSheet && isSpecialColorJob) return;

            const getRunCost = (runSizeFraction, formName, printingMethod, formNumber = 0) => {
                const sheetsNeeded = Math.ceil(qty * runSizeFraction);
                if (sheetsNeeded === 0) return { paperCost: 0, printingCost: 0, dripupCost: 0, totalSheets: 0, breakdown: '' };
                let wastage = 0;
                if (sheetsNeeded <= 1500) wastage = 100; else if (sheetsNeeded <= 3000) wastage = 125; else if (sheetsNeeded <= 4500) wastage = 150; else if (sheetsNeeded <= 6000) wastage = 175; else if (sheetsNeeded <= 14000) wastage = 200; else if (sheetsNeeded <= 50000) wastage = 300; else wastage = 400;
                const totalSheetsForForm = sheetsNeeded + wastage;
                let paperArea;
                if (inputs.reelcut) { paperArea = (usedWidth + 1) * (usedHeight + 1); } 
                else {
                    switch (`${currentSheet.width}x${currentSheet.height}`) {
                        case "13x26": case "14x26": case "15x25": paperArea = 400; break; case "19x25": paperArea = 600; break;
                        case "20x29.5": paperArea = 20 * 30; break; default: paperArea = currentSheet.width * currentSheet.height; break;
                    }
                }
                const paperWeightForForm = (paperArea * gsm * totalSheetsForForm) / (3100 * 500);
                let paperCostForForm = paperWeightForForm * rate;
                if (inputs.paperType === "hotmailsticker") { paperCostForForm = totalSheetsForForm * currentSheet.price; }
                let printingCostForForm = 0;
                const rounds = Math.ceil(sheetsNeeded / 1000);
                const rounds2 = Math.ceil(sheetsNeeded * 2 / 1000);
                let methodForCosting = printingMethod + colorType;
                const { baseCost, largeBaseCost, impressionCost, largeImpressionCost } = getPrintingCostParams();
                let printingBreakdown = '';
                if (isLargeFormatSheet) {
                    switch (methodForCosting) {
                        case "selfback": case "doublegripper": printingCostForForm = rounds2 * largeImpressionCost + largeBaseCost; printingBreakdown = `(Rounds: ${rounds2} * Imp.: ₹${largeImpressionCost} + Base: ₹${largeBaseCost})`; break;
                        case "frontback": printingCostForForm = (rounds * largeImpressionCost + largeBaseCost) * 2; printingBreakdown = `((Rounds: ${rounds} * Imp.: ₹${largeImpressionCost} + Base: ₹${largeBaseCost}) * 2)`; break;
                        case "oneside": printingCostForForm = rounds * largeImpressionCost + largeBaseCost; printingBreakdown = `(Rounds: ${rounds} * Imp.: ₹${largeImpressionCost} + Base: ₹${largeBaseCost})`; break;
                    }
                } else {
                    switch (methodForCosting) {
                        case "selfback": case "doublegripper": printingCostForForm = rounds2 * impressionCost + baseCost; printingBreakdown = `(Rounds: ${rounds2} * Imp.: ₹${impressionCost} + Base: ₹${baseCost})`; break;
                        case "frontback": printingCostForForm = (rounds * impressionCost + baseCost) * 2; printingBreakdown = `((Rounds: ${rounds} * Imp.: ₹${impressionCost} + Base: ₹${baseCost}) * 2)`; break;
                        case "oneside": printingCostForForm = rounds * impressionCost + baseCost; printingBreakdown = `(Rounds: ${rounds} * Imp.: ₹${impressionCost} + Base: ₹${baseCost})`; break;
                        case "selfback2": case "doublegripper2": printingCostForForm = rounds2 * 200 + 800; break;
                        case "frontback2": printingCostForForm = (rounds * 200 + 600) * 2; break;
                        case "oneside2": printingCostForForm = rounds * 200 + 600; break;
                        case "selfback1": case "doublegripper1": printingCostForForm = rounds2 * 150 + 600; break;
                        case "frontback1": printingCostForForm = (rounds * 150 + 450) * 2; break;
                        case "oneside1": printingCostForForm = rounds * 150 + 450; break;
                    }
                }
                let dripupCostForForm = 0;
                if (inputs.additionalProcess === 'dripup' || inputs.additionalProcess2 === 'dripup') {
                    let dripupCost = (totalSheetsForForm <= 6000) ? (paperArea * 0.85 * totalSheetsForForm) / 100 + 600 : (paperArea * 0.75 * totalSheetsForForm) / 100 + 600;
                    dripupCostForForm = Math.max(dripupCost, 6000);
                }
                const breakdownHTML = `<div class="mt-2 p-2 border border-gray-200 rounded-md"><p class="font-semibold">${formName} ${formNumber > 0 ? `(Form ${formNumber})` : ''} on ${currentSheet.width}x${currentSheet.height}:</p><p>Sheets: ${sheetsNeeded} + ${wastage} (wastage) = ${totalSheetsForForm}</p><p>Paper Cost: ₹${paperCostForForm.toFixed(2)}</p><p>Printing Cost (${printingMethod}): ₹${printingCostForForm.toFixed(2)} <span class="text-xs italic text-gray-500">${printingBreakdown}</span></p></div>`;
                return { paperCost: paperCostForForm, printingCost: printingCostForForm, dripupCost: dripupCostForForm, totalSheets: totalSheetsForForm, breakdown: breakdownHTML };
            };
            const fullFormsCount = Math.floor(noOfLeaves / currentUps);
            const remainingLeaves = noOfLeaves % currentUps;
            let cost = { paper: 0, printing: 0, dripup: 0, sheets: 0, breakdown: '' };
            for (let i = 1; i <= fullFormsCount; i++) {
                const res = getRunCost(1, `Full Form`, isBothSides ? 'frontback' : 'oneside', i);
                cost.paper += res.paperCost; cost.printing += res.printingCost; cost.dripup += res.dripupCost; cost.sheets += res.totalSheets; cost.breakdown += res.breakdown;
            }
            if (remainingLeaves > 0) {
                const fractionNeeded = remainingLeaves / currentUps;
                let method1 = (isBothSides && fractionNeeded > 0.5) ? 'frontback' : (isBothSides ? 'selfback' : 'oneside');
                const runSizeFraction1 = 1;
                const scenario1 = getRunCost(runSizeFraction1, `Partial Form for ${remainingLeaves} leaves`, method1);
                cost.paper += scenario1.paperCost;
                cost.printing += scenario1.printingCost;
                cost.dripup += scenario1.dripupCost;
                cost.sheets += scenario1.totalSheets;
                cost.breakdown += scenario1.breakdown;
            }
            const totalCost = cost.paper + cost.printing + cost.dripup;
            if (totalCost < bestFit.cost) {
                bestFit = { cost: totalCost, sheet: currentSheet, ups: currentUps, totalPaperCost: cost.paper, totalPrintingCost: cost.printing, totalDripupCost: cost.dripup, grandTotalSheets: cost.sheets, detailedBreakdownHTML: cost.breakdown, usedWidth: usedWidth, usedHeight: usedHeight, isReelCut: inputs.reelcut };
            }
        });
    } else {
        let methodsToCheck = [];
        switch (inputs.printingType) {
            case 'bothsides': methodsToCheck = ['selfback', 'frontback', 'doublegripper']; break;
            case 'oneside': methodsToCheck = ['oneside']; break;
            case 'bothsides2': methodsToCheck = ['selfback2', 'frontback2', 'doublegripper2']; break;
            case 'oneside2': methodsToCheck = ['oneside2']; break;
            case 'bothsides1': methodsToCheck = ['selfback1', 'frontback1', 'doublegripper1']; break;
            case 'oneside1': methodsToCheck = ['oneside1']; break;
            default: break;
        }
        fullSheets.forEach((currentSheet) => {
            methodsToCheck.forEach((method) => {
                const isLargeFormatSheet = (currentSheet.width === 20 && (currentSheet.height === 30 || currentSheet.height === 29.5));
                const isSpecialColorJob = method.includes('1') || method.includes('2');
                if (isLargeFormatSheet && isSpecialColorJob) return;
                const shortSide = Math.min(currentSheet.width, currentSheet.height);
                const longSide = Math.max(currentSheet.width, currentSheet.height);
                let usableShort = shortSide - gripper;
                if (method.includes('doublegripper')) { usableShort = shortSide - (gripper * 2); }
                if (usableShort <= 0) return;
                const fitW1 = Math.floor(longSide / adjustedWidth);
                const fitH1 = Math.floor(usableShort / adjustedHeight);
                const ups1 = fitW1 * fitH1;
                const fitW2 = Math.floor(longSide / adjustedHeight);
                const fitH2 = Math.floor(usableShort / adjustedWidth);
                const ups2 = fitW2 * fitH2;
                const maxUps = Math.max(ups1, ups2);
                if (maxUps === 0) return;
                if (maxUps === 2) {
                    const isShortSideLayout = (ups1 === 2 && fitH1 === 2) || (ups2 === 2 && fitW2 === 2);
                    const isLongSideLayout = (ups1 === 2 && fitW1 === 2) || (ups2 === 2 && fitH2 === 2);
                    if (method.includes('selfback') && !isLongSideLayout) return;
                    if (method.includes('doublegripper') && !isShortSideLayout) return;
                } else if (method.includes('selfback')) {
                    if (maxUps % 4 !== 0) return;
                } else if (method.includes('doublegripper')) {
                    if (maxUps % 2 !== 0 || maxUps % 4 === 0) return;
                }
                const sheetsNeeded = Math.ceil(qty / maxUps);
                if (sheetsNeeded === 0) return;
                let wastage = 0;
                if (sheetsNeeded <= 1500) wastage = 100; else if (sheetsNeeded <= 3000) wastage = 125; else if (sheetsNeeded <= 4500) wastage = 150; else if (sheetsNeeded <= 6000) wastage = 175; else if (sheetsNeeded <= 14000) wastage = 200; else if (sheetsNeeded <= 50000) wastage = 300; else wastage = 400;
                const totalSheetsForRun = sheetsNeeded + wastage;
                const usedWidth = ups1 > ups2 ? Math.floor(longSide / adjustedWidth) * adjustedWidth : Math.floor(longSide / adjustedHeight) * adjustedHeight;
                const usedHeight = ups1 > ups2 ? Math.floor(usableShort / adjustedHeight) * adjustedHeight : Math.floor(usableShort / adjustedWidth) * adjustedWidth;
                let paperArea;
                if (inputs.reelcut) { paperArea = (usedWidth + 1) * (usedHeight + 1); } 
                else {
                    switch (`${currentSheet.width}x${currentSheet.height}`) {
                        case "13x26": case "14x26": case "15x25": paperArea = 400; break; case "19x25": paperArea = 600; break;
                        case "20x29.5": paperArea = 20 * 30; break; default: paperArea = currentSheet.width * currentSheet.height; break;
                    }
                }
                const paperWeight = (paperArea * gsm * totalSheetsForRun) / (3100 * 500);
                let paperCost = paperWeight * rate;
                if (inputs.paperType === "hotmailsticker") { paperCost = totalSheetsForRun * currentSheet.price; }
                let printingCost = 0;
                const rounds = Math.ceil(sheetsNeeded / 1000);
                const rounds2 = Math.ceil(sheetsNeeded * 2 / 1000);
                const { baseCost, largeBaseCost, impressionCost, largeImpressionCost } = getPrintingCostParams();
                let printingBreakdown = '';
                if (isLargeFormatSheet) {
                    switch (method) {
                        case "selfback": case "doublegripper": printingCost = rounds2 * largeImpressionCost + largeBaseCost; printingBreakdown = `(Rounds: ${rounds2} * Imp.: ₹${largeImpressionCost} + Base: ₹${largeBaseCost})`; break;
                        case "frontback": printingCost = (rounds * largeImpressionCost + largeBaseCost) * 2; printingBreakdown = `((Rounds: ${rounds} * Imp.: ₹${largeImpressionCost} + Base: ₹${largeBaseCost}) * 2)`; break;
                        case "oneside": printingCost = rounds * largeImpressionCost + largeBaseCost; printingBreakdown = `(Rounds: ${rounds} * Imp.: ₹${largeImpressionCost} + Base: ₹${largeBaseCost})`; break;
                    }
                } else {
                    switch (method) {
                        case "selfback": case "doublegripper": printingCost = rounds2 * impressionCost + baseCost; printingBreakdown = `(Rounds: ${rounds2} * Imp.: ₹${impressionCost} + Base: ₹${baseCost})`; break;
                        case "frontback": printingCost = (rounds * impressionCost + baseCost) * 2; printingBreakdown = `((Rounds: ${rounds} * Imp.: ₹${impressionCost} + Base: ₹${baseCost}) * 2)`; break;
                        case "oneside": printingCost = rounds * impressionCost + baseCost; printingBreakdown = `(Rounds: ${rounds} * Imp.: ₹${impressionCost} + Base: ₹${baseCost})`; break;
                        case "selfback2": case "doublegripper2": printingCost = rounds2 * 200 + 800; break;
                        case "frontback2": printingCost = (rounds * 200 + 600) * 2; break;
                        case "oneside2": printingCost = rounds * 200 + 600; break;
                        case "selfback1": case "doublegripper1": printingCost = rounds2 * 150 + 600; break;
                        case "frontback1": printingCost = (rounds * 150 + 450) * 2; break;
                        case "oneside1": printingCost = rounds * 150 + 450; break;
                    }
                }
                let dripupCostForForm = 0;
                if (inputs.additionalProcess === 'dripup' || inputs.additionalProcess2 === 'dripup') {
                    let dripupCost = (totalSheetsForRun <= 6000) ? (paperArea * 0.85 * totalSheetsForRun) / 100 + 600 : (paperArea * 0.75 * totalSheetsForRun) / 100 + 600;
                    dripupCostForForm = Math.max(dripupCost, 6000);
                }
                const totalCost = paperCost + printingCost + dripupCostForForm;
                if (totalCost < bestFit.cost) {
                    const breakdownHTML = `<div class="mt-2 p-2 border border-gray-200 rounded-md"><p class="font-semibold">Best Option on ${currentSheet.width}x${currentSheet.height} (UPS: ${maxUps})</p><p>Sheets: ${sheetsNeeded} + ${wastage} (wastage) = ${totalSheetsForRun}</p><p>Paper Cost: ₹${paperCost.toFixed(2)}</p><p>Printing Cost (${method}): ₹${printingCost.toFixed(2)} <span class="text-xs italic text-gray-500">${printingBreakdown}</span></p></div>`;
                    bestFit = { cost: totalCost, sheet: currentSheet, ups: maxUps, totalPaperCost: paperCost, totalPrintingCost: printingCost, totalDripupCost: dripupCostForForm, grandTotalSheets: totalSheetsForRun, detailedBreakdownHTML: breakdownHTML, usedWidth: usedWidth, usedHeight: usedHeight, isReelCut: inputs.reelcut };
                }
            });
        });
    }
    return bestFit;
  };
  
  const getPostPressCosts = (baseCost) => {
    const qty = parseInt(inputs.qty) || 0;
    const noOfLeaves = parseInt(inputs.noOfLeaves) || 1;
    let lamArea;
    if (baseCost.isReelCut) {
        lamArea = (baseCost.usedWidth + 1) * (baseCost.usedHeight + 1);
    } else {
        lamArea = baseCost.sheet.width * baseCost.sheet.height;
    }
    let lamCost = 0;
    switch (inputs.lamination) {
        case "mattbs": lamCost = (lamArea * 0.90 * baseCost.grandTotalSheets) / 100; break;
        case "glossbs": lamCost = (lamArea * 0.84 * baseCost.grandTotalSheets) / 100; break;
        case "mattos": lamCost = (lamArea * 0.45 * baseCost.grandTotalSheets) / 100; break;
        case "glossos": lamCost = (lamArea * 0.42 * baseCost.grandTotalSheets) / 100; break;
        case "varnishbs": lamCost = (lamArea * 0.5 * baseCost.grandTotalSheets) / 100; break;
        case "varnishos": lamCost = (lamArea * 0.25 * baseCost.grandTotalSheets) / 100; break;
        case "thermattbs": lamCost = (lamArea * 1.80 * baseCost.grandTotalSheets) / 100; break;
        case "thermattos": lamCost = (lamArea * 0.85 * baseCost.grandTotalSheets) / 100; break;
        case "velmattbs": lamCost = (lamArea * 6 * baseCost.grandTotalSheets) / 100; break;
        case "velmattos": lamCost = (lamArea * 3 * baseCost.grandTotalSheets) / 100; break;
        default: break;
    }
    let punchCost = 0;
    if (inputs.punching === "yes") punchCost = Math.ceil(baseCost.grandTotalSheets / 1000) * 400;
    else if (inputs.punching === "stickerpunching") punchCost = Math.ceil(baseCost.grandTotalSheets / 1000) * 800;
    const totalItemQty = qty * noOfLeaves;
    let fabricationCost = 0, fabRate = 0;
    switch (inputs.fabrication) {
        case "singlefold": fabRate = 100; break; case "multifold": fabRate = 150; break;
        case "cardfolding": fabRate = 300; break; case "threading": fabRate = 300; break;
        case "pouch": fabRate = 750; break; case "box": fabRate = 600; break;
        case "tentcard": fabRate = 400; break; case "wobler": fabRate = 1300; break;
        case "fullgumming": fabricationCost = (lamArea * 1.5 * baseCost.grandTotalSheets) / 100; break;
        default: break;
    }
    if (fabRate > 0) fabricationCost = Math.ceil(qty / 1000) * fabRate * noOfLeaves;
    let fabricationCostN = 0, fabRateN = 0;
    switch (inputs.fabricationN) {
        case "singlefoldN": fabRateN = 100; break; case "multifoldN": fabRateN = 150; break;
        case "cardfoldingN": fabRateN = 300; break; case "threadingN": fabRateN = 300; break;
        case "pouchN": fabRateN = 750; break; case "boxN": fabRateN = 600; break;
        case "tentcardN": fabRateN = 400; break; case "woblerN": fabRateN = 1300; break;
        case "fullgummingN": fabricationCostN = (lamArea * 1.5 * baseCost.grandTotalSheets) / 100; break;
        default: break;
    }
    if (fabRateN > 0) fabricationCostN = Math.ceil(qty / 1000) * fabRateN * noOfLeaves;
    const k3_sheets = Math.ceil(baseCost.grandTotalSheets / 1000);
    const getAdditionalCost = (processValue, width, height, itemQty) => {
        if (processValue === '0' || processValue === 'dripup') return 0;
        let oldCost = 0, newCost = 0;
        switch (processValue) {
            case "spotuv": oldCost = k3_sheets * 1500; break; case "raiseduv": oldCost = k3_sheets * 2500; break;
            case "stampfoil": oldCost = k3_sheets * 2000 + 2000; break; case "magicfoil": oldCost = k3_sheets * 8000; break;
            case "spotuvbs": oldCost = k3_sheets * 3000; break; case "raiseduvbs": oldCost = k3_sheets * 5000; break;
            case "stampfoilbs": oldCost = k3_sheets * 4000 + 4000; break; case "magicfoilbs": oldCost = k3_sheets * 16000; break;
            default: break;
        }
        if (width > 0 && height > 0) {
            const area = width * height;
            switch (processValue) {
                case "spotuv": case "stampfoil": newCost = area * itemQty * 0.03; break;
                case "spotuvbs": case "stampfoilbs": newCost = area * itemQty * 0.055; break;
                case "raiseduv": newCost = area * itemQty * 0.04; break;
                case "raiseduvbs": newCost = area * itemQty * 0.06; break;
                case "magicfoil": newCost = area * itemQty * 0.065; break;
                case "magicfoilbs": newCost = area * itemQty * 0.13; break;
                default: break;
            }
        }
        return Math.max(oldCost, newCost);
    };
    let additionalProcessCost = getAdditionalCost(inputs.additionalProcess, parseFloat(inputs.additionalProcessWidth), parseFloat(inputs.additionalProcessHeight), totalItemQty);
    let additionalProcessCost2 = getAdditionalCost(inputs.additionalProcess2, parseFloat(inputs.additionalProcess2Width), parseFloat(inputs.additionalProcess2Height), totalItemQty);
    const hcut = parseFloat(inputs.hcut) || 0;
    const wcut = parseFloat(inputs.wcut) || 0;
    const upsInput = parseFloat(inputs.ups) || 0;
    let halfcuttingAmt = 0;
    if (inputs.fabricationN === 'halfcutting' && hcut > 0 && wcut > 0 && upsInput > 0 && baseCost.grandTotalSheets > 0) {
        let rate = (qty > 10000) ? 0.06 : 0.07;
        halfcuttingAmt = (wcut + hcut) * rate * upsInput * baseCost.grandTotalSheets;
        if (halfcuttingAmt > 0 && halfcuttingAmt < 500) halfcuttingAmt = 500;
    }
    return { lamCost, dieType: parseFloat(inputs.dieType), punchCost, fabricationCost, fabricationCostN, additionalProcessCost, additionalProcessCost2, halfcuttingAmt, calendarFinishingCost: 0 };
  };

  const calculateComponentPrintCost = (componentWidth, componentHeight, gsm, qty, rate, includePrinting = true) => {
    let bestFit = { cost: Infinity, paperCost: 0, printingCost: 0, totalSheets: 0, paperArea: 0 };
    const fullSheets = [ { width: 18, height: 25 }, { width: 18, height: 23 }, { width: 15, height: 20 }, { width: 20, height: 30 }, { width: 12, height: 23 }, { width: 15, height: 25 }, { width: 12, height: 25 }, { width: 19, height: 25 }, { width: 20, height: 29.5 }, { width: 13, height: 26 }, { width: 14, height: 26 } ];
    fullSheets.forEach(sheet => {
        const ups = Math.max(
            Math.floor(sheet.width / componentWidth) * Math.floor(sheet.height / componentHeight),
            Math.floor(sheet.width / componentHeight) * Math.floor(sheet.height / componentWidth)
        );
        if (ups > 0) {
            const sheetsNeeded = Math.ceil(qty / ups);
            let wastage = 0;
            if (sheetsNeeded <= 1500) wastage = 100; else if (sheetsNeeded <= 3000) wastage = 150; else wastage = 200;
            const totalSheets = sheetsNeeded + wastage;
            const paperArea = sheet.width * sheet.height;
            const paperCost = (paperArea * gsm * totalSheets) / (3100 * 500) * rate;
            const printingCost = includePrinting ? (Math.ceil(sheetsNeeded / 1000) * 400 + 1600) : 0;
            const totalCost = paperCost + printingCost;
            if (totalCost < bestFit.cost) {
                bestFit = { cost: totalCost, paperCost: paperCost, printingCost: printingCost, totalSheets: totalSheets, paperArea: paperArea };
            }
        }
    });
    return bestFit;
  };

  const calculateTableCalendarStandCost = (isLandscape, jobWidth, jobHeight, qty) => {
    const longEdge = isLandscape ? jobWidth : jobHeight;
    const shortEdge = isLandscape ? jobHeight : jobWidth;
    const wiroCost = (longEdge * 0.5 + 6) * qty;
    const kappaWidth = isLandscape ? shortEdge * 2 + 3 : longEdge * 2 + 3;
    const kappaHeight = isLandscape ? longEdge : shortEdge;
    const kappaSheets = [{w: 25, h: 36, price: 40}, {w: 31, h: 41, price: 60}];
    let bestKappaCost = Infinity;
    kappaSheets.forEach(sheet => {
        const ups = Math.max(
            Math.floor(sheet.w / kappaWidth) * Math.floor(sheet.h / kappaHeight),
            Math.floor(sheet.w / kappaHeight) * Math.floor(sheet.h / kappaWidth)
        );
        if (ups > 0) {
            const sheetsNeeded = Math.ceil(qty / ups);
            const cost = sheetsNeeded * sheet.price;
            if (cost < bestKappaCost) {
                bestKappaCost = cost;
            }
        }
    });
    const kappaCost = (bestKappaCost === Infinity) ? 0 : bestKappaCost;
    const outerPaperWidth = kappaWidth + 2;
    const outerPaperHeight = kappaHeight + 2;
    const outerPaperResult = calculateComponentPrintCost(outerPaperWidth, outerPaperHeight, 170, qty, 78, !inputs.plainOuterPaper);
    const outerPaperLaminationCost = (outerPaperResult.paperArea * 0.45 * outerPaperResult.totalSheets) / 100;
    const outerPaperCost = outerPaperResult.cost + outerPaperLaminationCost;
    const aaspasResult = calculateComponentPrintCost(kappaWidth, kappaHeight, 100, qty, 75, false);
    const aaspasCost = aaspasResult.cost;
    let gummingCost = 0;
    if(inputs.outerPaperGumming) {
        const outerPaperArea = outerPaperWidth * outerPaperHeight;
        gummingCost = (outerPaperArea * 1.5 * qty) / 100;
    }
    let ohpCost = 0;
    if(inputs.ohpSheet) {
        const ohpSheetW = 12, ohpSheetH = 18;
        const upsOnOhp = Math.max(
            Math.floor(ohpSheetW / jobWidth) * Math.floor(ohpSheetH / jobHeight),
            Math.floor(ohpSheetW / jobHeight) * Math.floor(ohpSheetH / jobWidth)
        );
        if(upsOnOhp > 0) {
            const ohpSheetsNeeded = Math.ceil(qty / upsOnOhp);
            ohpCost = ohpSheetsNeeded * 15;
        }
    }
    const makingCost = 7 * qty;
    const totalStandCost = wiroCost + kappaCost + outerPaperCost + aaspasCost + makingCost + gummingCost + ohpCost;
    const breakdown = `<hr class="my-2 border-gray-400"><h4 class="text-md font-semibold text-gray-800 mt-4 mb-2">Table Calendar Stand Breakdown:</h4><p><strong>Wiro Cost:</strong> ₹${wiroCost.toFixed(2)}</p><p><strong>Kappa Board Cost:</strong> ₹${kappaCost.toFixed(2)}</p><p><strong>Outer Paper Cost (incl. Lamination):</strong> ₹${outerPaperCost.toFixed(2)}</p><p><strong>Aas Paas Paper Cost:</strong> ₹${aaspasCost.toFixed(2)}</p><p><strong>Outer Paper Gumming:</strong> ₹${gummingCost.toFixed(2)}</p><p><strong>OHP Sheet Cost:</strong> ₹${ohpCost.toFixed(2)}</p><p><strong>Making Cost:</strong> ₹${makingCost.toFixed(2)}</p>`;
    return { total: totalStandCost, breakdown: breakdown };
  };

  const calculateCalendarCost = () => {
    setError('');
    if (!inputs.customerName) {
        setError('Please select a customer before calculating.');
        return;
    }
    
    // GSM validation
    const selectedPaper = paperTypes.find(p => p.paperTypeName === inputs.paperType);
    const gsmValue = parseInt(inputs.gsm);
    if (selectedPaper && selectedPaper.minGsm && selectedPaper.maxGsm) {
        if (gsmValue < selectedPaper.minGsm || gsmValue > selectedPaper.maxGsm) {
            setError(`GSM must be between ${selectedPaper.minGsm} and ${selectedPaper.maxGsm} for ${selectedPaper.paperTypeName}`);
            return;
        }
    }
    
    // Not clearing results to allow appending
    const baseCost = getBasePrintCost();
    const qty = parseInt(inputs.qty) || 0;
    const jobWidth = parseInputToInches(inputs.jobWidth);
    const jobHeight = parseInputToInches(inputs.jobHeight);
    if (baseCost.cost === Infinity) {
        setError("Error: Could not calculate base print cost. Check job dimensions and paper sizes.");
        return;
    }
    const shortEdge = Math.min(jobWidth, jobHeight);
    const longEdge = Math.max(jobWidth, jobHeight);
    let calendarFinishingCost = 0;
    let standBreakdown = '';
    if ((inputs.calendarType !== 'patti' && inputs.calendarType !== 'wiro') && (shortEdge <= 0 || longEdge <= 0)) {
         setError("Please enter valid Width and Height for Table Calendar cost.");
         return;
    }
    switch(inputs.calendarType) {
        case 'patti':
            let pattiRate = 0;
            if (qty < 2100) pattiRate = 0.36;
            else if (qty >= 2100 && qty <= 5100) pattiRate = 0.32;
            else pattiRate = 0.29;
            calendarFinishingCost = shortEdge * pattiRate * qty;
            break;
        case 'wiro':
            let wiroRate = 0;
            if (qty < 2100) wiroRate = 0.85;
            else if (qty >= 2100 && qty <= 5100) wiroRate = 0.78;
            else wiroRate = 0.75;
            const baseWiroCost = shortEdge * wiroRate * qty;
            const additionalWiroCost = 2000 + (0.06 * shortEdge * qty);
            calendarFinishingCost = baseWiroCost + additionalWiroCost;
            break;
        case 'table_landscape':
        case 'table_portrait':
            const isLandscape = inputs.calendarType === 'table_landscape';
            const standCosts = calculateTableCalendarStandCost(isLandscape, jobWidth, jobHeight, qty);
            calendarFinishingCost = standCosts.total;
            standBreakdown = standCosts.breakdown;
            break;
        default: break;
    }
    const postPressCosts = getPostPressCosts(baseCost);
    postPressCosts.calendarFinishingCost = calendarFinishingCost;
    let totalCost = baseCost.totalPaperCost + baseCost.totalPrintingCost + baseCost.totalDripupCost + postPressCosts.lamCost + postPressCosts.dieType + postPressCosts.punchCost + postPressCosts.fabricationCost + postPressCosts.fabricationCostN + postPressCosts.additionalProcessCost + postPressCosts.additionalProcessCost2 + postPressCosts.halfcuttingAmt + calendarFinishingCost;
    
    const selectedCustomer = customers.find(c => c.customerName === inputs.customerName);
    const margin = selectedCustomer ? parseFloat(selectedCustomer.margin) : 0;

    if (margin > 0) {
        totalCost *= (1 + margin / 100);
    }

    const finalRate = qty > 0 ? totalCost / qty : 0;
    const newResult = { 
        qty,
        totalCost, 
        finalRate, 
        baseCost, 
        postPressCosts, 
        standBreakdown 
    };
    setResults(prevResults => [...prevResults, newResult]);
  };

  // Save/Update Quotation
  const handleSave = () => {
    if (results.length === 0) {
      setError('Please calculate first!');
      return;
    }
    if (!inputs.customerName) {
      setError('Please select a customer before saving.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess('');
    setError('');

    const quotationData = {
      productType: 'Calendar',
      serial: formData && formData.serial ? formData.serial : getNextSerial(),
      customerName: inputs.customerName,
      inputs: inputs,
      results: results,
      createdAt: formData && formData.createdAt ? formData.createdAt : new Date().toISOString(),
    };

    const url = formData && formData.id ? `${apiUrl}/api/quotations/${formData.id}` : `${apiUrl}/api/quotations`;
    const method = formData && formData.id ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quotationData),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(savedQuotation => {
      setSaveSuccess('Quotation saved successfully!');
      setIsSaving(false);
      if (onSaved) {
        onSaved(savedQuotation);
      }
      setTimeout(() => setSaveSuccess(''), 3000);
    })
    .catch(error => {
      console.error('Error saving quotation:', error);
      setError('Failed to save quotation. Please try again.');
      setIsSaving(false);
    });
  };

  const handleDeleteResult = (index) => {
    setResults(results.filter((_, i) => i !== index));
  };

  const handleAdjustment = (direction) => {
    const percentage = parseFloat(adjustmentPercentage) || 0;
    if (percentage === 0) return;
    const multiplier = direction === 'add' ? (1 + percentage / 100) : (1 - percentage / 100);
    setResults(prevResult => prevResult.map(r => {
      const newTotalCost = r.totalCost * multiplier;
      const newFinalRate = newTotalCost / r.qty;
      return { ...r, totalCost: newTotalCost, finalRate: newFinalRate };
    }));
  };

  const handleAmountAdjustment = (direction) => {
    const amount = parseFloat(adjustmentAmount) || 0;
    if (amount === 0) return;
    const adjustment = direction === 'add' ? amount : -amount;
    setResults(prevResult => prevResult.map(r => {
      const newTotalCost = r.totalCost + adjustment;
      const newFinalRate = newTotalCost / r.qty;
      return { ...r, totalCost: newTotalCost, finalRate: newFinalRate };
    }));
  };

  // --- RENDER METHOD ---
  
  const renderCalendarSpecificOptions = () => {
      if (inputs.calendarType === 'table_landscape' || inputs.calendarType === 'table_portrait') {
          return (
              <div className="mb-4 space-y-2">
                  <label className="modern-toggle-label">
                      <input type="checkbox" id="plainOuterPaper" checked={inputs.plainOuterPaper} onChange={handleInputChange} className="modern-toggle" />
                      <span>Plain Outer Paper</span>
                  </label>
                  <label className="modern-toggle-label">
                      <input type="checkbox" id="ohpSheet" checked={inputs.ohpSheet} onChange={handleInputChange} className="modern-toggle" />
                      <span>Add OHP Sheet</span>
                  </label>
                  <label className="modern-toggle-label">
                      <input type="checkbox" id="outerPaperGumming" checked={inputs.outerPaperGumming} onChange={handleInputChange} className="modern-toggle" />
                      <span>Add Outer Paper Gumming</span>
                  </label>
              </div>
          );
      }
      return null;
  };

  return (
    <div className={`cuttosheet-flex-container ${results.length > 0 ? 'results-visible' : ''}`}>
      <div className="cuttosheet-box cuttosheet-form-box">
        <h1 className="form-title-pink">Calendar Quotation</h1>
        <form className="cut-to-sheet-form" onSubmit={e => e.preventDefault()}>
          <div className="form-grid-modern">
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ flexGrow: 1 }}>
                <label htmlFor="customerName" className="input-label">Customer Name</label>
                <input
                    type="text"
                    placeholder="Search Customer"
                    className="input-box mb-2"
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                />
                <select id="customerName" name="customerName" className="input-box" value={inputs.customerName} onChange={handleInputChange}>
                  <option value="">-- Select Customer --</option>
                  {filteredCustomers.sort((a, b) => (a.customerName || '').localeCompare(b.customerName || '')).map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
                </select>
              </div>
              <button
                type="button"
                className="save-btn-modern"
                style={{ padding: '10px 15px', fontSize: '1.2rem' }}
                onClick={() => onNavigate('Customer Master')}
              >
                +
              </button>
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="calendarType">Calendar Type</label>
              <select id="calendarType" name="calendarType" className="input-box" value={inputs.calendarType} onChange={handleInputChange}>
                <option value="patti">Patti Calendar</option>
                <option value="wiro">Wall Wiro Calendar</option>
                <option value="table_landscape">Table Calendar Landscape</option>
                <option value="table_portrait">Table Calendar Potrait</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="paperType">Paper Type</label>
              <select id="paperType" name="paperType" className="input-box" value={inputs.paperType} onChange={(e) => {
                  const selectedPaperType = paperTypes.find(p => p.paperTypeName === e.target.value);
                  if (selectedPaperType) {
                      setInputs(prev => ({
                          ...prev,
                          paperType: selectedPaperType.paperTypeName,
                          rate: selectedPaperType.ratePerKg,
                      }));
                  } else {
                      setInputs(prev => ({ ...prev, paperType: e.target.value }));
                  }
              }}>
                <option value="">-- Select --</option>
                {paperTypes.map(p => <option key={p.id} value={p.paperTypeName}>{p.paperTypeName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="qty">Quantity (pcs)</label>
              <input type="number" id="qty" name="qty" className="input-box" value={inputs.qty} onChange={handleInputChange} placeholder="e.g., 1000" />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="noOfLeaves">Leaves</label>
              <input type="number" id="noOfLeaves" name="noOfLeaves" className="input-box" value={inputs.noOfLeaves} onChange={handleInputChange} placeholder="e.g., 1" />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="jobWidth">Job Width (inches)</label>
              <input type="text" id="jobWidth" name="jobWidth" className="input-box" value={inputs.jobWidth} onChange={handleInputChange} placeholder="e.g., 8.5" />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="jobHeight">Job Height (inches)</label>
              <input type="text" id="jobHeight" name="jobHeight" className="input-box" value={inputs.jobHeight} onChange={handleInputChange} placeholder="e.g., 11" />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="gsm">GSM</label>
              <input type="number" id="gsm" name="gsm" className="input-box" value={inputs.gsm} onChange={(e) => {
                const selectedPaper = paperTypes.find(p => p.paperTypeName === inputs.paperType);
                const value = parseInt(e.target.value);
                if (selectedPaper && selectedPaper.minGsm && selectedPaper.maxGsm) {
                  if (value < selectedPaper.minGsm || value > selectedPaper.maxGsm) {
                    setError(`GSM must be between ${selectedPaper.minGsm} and ${selectedPaper.maxGsm} for ${selectedPaper.paperTypeName}`);
                  } else {
                    setError('');
                  }
                }
                handleInputChange(e);
              }} placeholder="e.g., 300" />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="rate">Rate per Kg</label>
              <input type="number" id="rate" name="rate" className="input-box" value={inputs.rate} onChange={handleInputChange} step="0.01" placeholder="e.g., 78" />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="printingType">Printing Type</label>
              <select id="printingType" name="printingType" className="input-box" value={inputs.printingType} onChange={handleInputChange}>
                      <option value="bothsides">Both Sides (4+4 Color)</option>
                      <option value="oneside">One Side (4+0 Color)</option>
                      <option value="bothsides2">Both Sides (2+2 Color)</option>
                      <option value="oneside2">One Side (2+0 Color)</option>
                      <option value="bothsides1">Both Sides (1+1 Color)</option>
                      <option value="oneside1">One Side (1+0 Color)</option>
                    </select>
                </div>
            <div className="form-group">
              <label className="input-label" htmlFor="lamination">Lamination / Varnish</label>
              <select id="lamination" name="lamination" className="input-box" value={inputs.lamination} onChange={handleInputChange}>
                      <option value="none">None</option>
                      {laminationTypes && laminationTypes.map(lamination => (
                        <option key={lamination.id} value={lamination.id}>
                          {lamination.laminationName}
                        </option>
                      ))}
                    </select>
                </div>

            </div>
          {renderCalendarSpecificOptions()}
          <div className="abc-checkboxes-modern flex-center" style={{marginBottom: 16, marginTop: 16}}>
            <label className="modern-toggle-label">
              <input type="checkbox" id="checkA" checked={inputs.checkA} onChange={() => handleAbcCheck('checkA')} className="modern-toggle" />
                <span>Nagesh</span>
            </label>
            <label className="modern-toggle-label">
              <input type="checkbox" id="checkB" checked={inputs.checkB} onChange={() => handleAbcCheck('checkB')} className="modern-toggle" />
                <span>long Run</span>
            </label>
            <label className="modern-toggle-label">
              <input type="checkbox" id="checkC" checked={inputs.checkC} onChange={() => handleAbcCheck('checkC')} className="modern-toggle" />
                <span>short run</span>
            </label>
            <label className="modern-toggle-label">
              <input type="checkbox" id="reelcut" checked={inputs.reelcut} onChange={handleInputChange} className="modern-toggle" />
                <span>Reel Cut</span>
            </label>
          </div>
          <div className="center-align-container">
            <button type="button" className="save-btn-modern" onClick={calculateCalendarCost}>Calculate</button>
            <button type="button" className="save-btn-modern" onClick={copySummary} style={{marginTop: '10px'}}>{copySuccess || 'Copy Summary'}</button>
          </div>
          <Modal show={!!error} onClose={() => setError('')}>
              <p className="text-lg text-red-600">{error}</p>
          </Modal>
        </form>
      </div>
      {results.length > 0 && (
        <div className="cuttosheet-box cuttosheet-result-box">
            <h3 className="form-title-pink">Quotation Details</h3>
            <div className="overflow-x-auto mb-4">
                <table className="result-table-modern compact-table">
                    <thead>
                        <tr>
                            <th>Quotation - {formData && formData.serial ? formData.serial : getNextSerial()}</th>
                            {results.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Quantity</td>
                            {results.map((r, i) => <td key={i}>{r.qty}</td>)}
                        </tr>
                        <tr>
                            <td>Calendar Type</td>
                            {results.map((r, i) => <td key={i}>{capitalizeFirstLetter(inputs.calendarType)}</td>)}
                        </tr>
                        <tr>
                            <td>Leaves</td>
                            {results.map((r, i) => <td key={i}>{inputs.noOfLeaves}</td>)}
                        </tr>
                        <tr>
                            <td>Size</td>
                            {results.map((r, i) => <td key={i}>{`${inputs.jobWidth} x ${inputs.jobHeight} in`}</td>)}
                        </tr>
                        <tr>
                            <td>GSM</td>
                            {results.map((r, i) => <td key={i}>{inputs.gsm}</td>)}
                        </tr>
                        <tr>
                            <td>Paper</td>
                            {results.map((r, i) => <td key={i}>{capitalizeFirstLetter(inputs.paperType)}</td>)}
                        </tr>
                        <tr>
                            <td>Printing</td>
                            {results.map((r, i) => <td key={i}>{capitalizeFirstLetter(inputs.printingType)}</td>)}
                        </tr>
                        <tr>
                            <td>Lamination</td>
                            {results.map((r, i) => <td key={i}>{capitalizeFirstLetter(inputs.lamination)}</td>)}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto mb-4">
                <table className="result-table-modern compact-table">
                    <thead>
                        <tr>
                            <th>Option</th>
                            <th>Total Amount</th>
                            <th>Rate per Pc</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r, i) => (
                            <tr key={i}>
                                <td>Option {i + 1}</td>
                                <td>₹{r.totalCost.toFixed(2)}</td>
                                <td>₹{r.finalRate.toFixed(2)}</td>
                                <td><button onClick={() => handleDeleteResult(i)} className="delete-btn-modern">-</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
              <div style={{ marginTop: 16, marginBottom: 8, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Terms & Conditions:</div>
                <ul style={{ marginLeft: 18, marginBottom: 0 }}>
                  <li>Packing and Boxes Charges will be extra, (only patti packing free)</li>
                  <li>Delivery Charges will be Additional</li>
                  <li style={{ fontSize: '0.92em', color: '#555' }}>GST Extra Applicable</li>
                </ul>
              </div>

            <div className="overflow-x-auto mb-4">
                <h4 className="text-lg font-semibold mb-3 text-gray-700">Cost Breakdown</h4>
                <table className="result-table-modern compact-table">
                    <thead>
                        <tr>
                            <th>Cost Type</th>
                            {results.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Paper Cost</td>
                            {results.map((r, i) => <td key={i}>₹{r.baseCost.totalPaperCost.toFixed(2)}</td>)}
                        </tr>
                        <tr>
                            <td>Printing Cost</td>
                            {results.map((r, i) => <td key={i}>₹{r.baseCost.totalPrintingCost.toFixed(2)}</td>)}
                        </tr>
                        {results.some(r => r.baseCost.totalDripupCost > 0) && (
                            <tr>
                                <td>Drip Up Cost</td>
                                {results.map((r, i) => <td key={i}>₹{r.baseCost.totalDripupCost.toFixed(2)}</td>)}
                            </tr>
                        )}
                        {results.some(r => r.postPressCosts.lamCost > 0) && (
                            <tr>
                                <td>Lamination Cost</td>
                                {results.map((r, i) => <td key={i}>₹{r.postPressCosts.lamCost.toFixed(2)}</td>)}
                            </tr>
                        )}
                        {results.some(r => r.postPressCosts.dieType > 0) && (
                            <tr>
                                <td>Die Cost</td>
                                {results.map((r, i) => <td key={i}>₹{r.postPressCosts.dieType.toFixed(2)}</td>)}
                            </tr>
                        )}
                        {results.some(r => r.postPressCosts.punchCost > 0) && (
                            <tr>
                                <td>Punching Cost</td>
                                {results.map((r, i) => <td key={i}>₹{r.postPressCosts.punchCost.toFixed(2)}</td>)}
                            </tr>
                        )}
                        {results.some(r => r.postPressCosts.fabricationCost > 0) && (
                            <tr>
                                <td>Fabrication Cost</td>
                                {results.map((r, i) => <td key={i}>₹{r.postPressCosts.fabricationCost.toFixed(2)}</td>)}
                            </tr>
                        )}
                        {results.some(r => r.postPressCosts.calendarFinishingCost > 0) && (
                            <tr>
                                <td>Finishing Cost</td>
                                {results.map((r, i) => <td key={i}>₹{r.postPressCosts.calendarFinishingCost.toFixed(2)}</td>)}
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex gap-4 justify-center">
                <button type="button" className="save-btn-modern" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : (serial ? 'Update Quotation' : 'Save Quotation')}
                </button>
            </div>
            {saveSuccess && <p className="text-green-600 mt-2 text-center">{saveSuccess}</p>}

            <div className="flex items-center justify-center my-4 gap-4 p-4 border-t border-gray-200">
                <div className="flex flex-col items-center gap-2">
                    <label className="input-label">Percitle Adjust</label>
                    <div className="flex items-center gap-2">
                        <input type="number" value={adjustmentPercentage} onChange={(e) => setAdjustmentPercentage(e.target.value)} placeholder="%" className="input-box" style={{width: '80px'}} />
                        <button onClick={() => handleAdjustment('add')} className="save-btn-modern">+</button>
                        <button onClick={() => handleAdjustment('subtract')} className="delete-btn-modern">-</button>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <label className="input-label">Amt Adjust</label>
                    <div className="flex items-center gap-2">
                        <input type="number" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} placeholder="Amt" className="input-box" style={{width: '80px'}} />
                        <button onClick={() => handleAmountAdjustment('add')} className="save-btn-modern">+</button>
                        <button onClick={() => handleAmountAdjustment('subtract')} className="delete-btn-modern">-</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
