import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../design-system.css';

// --- Reusable Components ---
const FormInput = ({ label, id, name, required, ...props }) => (
    <div className="form-group">
        <label htmlFor={id} className="input-label">
            {label} {required && <span style={{ color: 'red' }}>*</span>}
        </label>
        <input id={id} name={name || id} className="input-box" {...props} />
    </div>
);

const FormSelect = React.forwardRef(({ label, id, name, required, children, ...props }, ref) => (
    <div className="form-group">
        <label htmlFor={id} className="input-label">
            {label} {required && <span style={{ color: 'red' }}>*</span>}
        </label>
        <select id={id} name={name || id} className="input-box" {...props} ref={ref}>
            {children}
        </select>
    </div>
));

const Checkbox = ({ label, id, name, ...props }) => (
    <label className="modern-toggle-label" htmlFor={id}>
        <input id={id} name={name || id} type="checkbox" className="modern-toggle" {...props} />
        <span>{label}</span>
    </label>
);

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

const additionalProcessMap = {
    '0': 'None',
    'dripup': 'Drip Up',
    'spotuv': 'Spot UV',
    'raiseduv': 'Raised UV',
    'stampfoil': 'Stamp Foiling',
    'magicfoil': 'Magic Foil',
    'spotuvbs': 'Spot UV BS',
    'raiseduvbs': 'Raised UV BS',
    'stampfoilbs': 'Stamp Foiling BS',
    'magicfoilbs': 'Magic Foil BS'
};


function CutToSheet({ onSaved, formData, customers = [], paperTypes = [], onAddNewCustomer, getNextSerial, apiUrl, onNavigate }) {

    const [inputs, setInputs] = useState({
        customerName: '',
        paperType: '78',
        qty: 1000,
        noOfLeaves: 1,
        jobWidth: '',
        jobHeight: '',
        gsm: '',
        rate: 78,
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
    });

    // State for UI toggles, results, and error handling
    const [showAdditionalProcesses, setShowAdditionalProcesses] = useState(false);
    const [showAdditionalProcessInputs, setShowAdditionalProcessInputs] = useState(false);
    const [showAdditionalProcess2Inputs, setShowAdditionalProcess2Inputs] = useState(false);
    const [showHalfCutting, setShowHalfCutting] = useState(false);
    const [result, setResult] = useState([]);
    const [bestFitDetails, setBestFitDetails] = useState(null);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState('');
    const [adjustmentPercentage, setAdjustmentPercentage] = useState(0);
    const [adjustmentAmount, setAdjustmentAmount] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);

    // Effect to pre-fill form when editing
    useEffect(() => {
        if (formData && formData.inputs) {
            setInputs(formData.inputs);
            if (formData.results) {
                setResult(formData.results);
            }
        }
    }, [formData]);

    // Refs for DOM elements
    const paperTypeRef = useRef(null);
    const laminationRef = useRef(null);
    const calculateBtnRef = useRef(null);
    const dieTypeRef = useRef(null);
    const punchingRef = useRef(null);
    const fabricationRef = useRef(null);
    const fabricationNRef = useRef(null);

    const capitalizeFirstLetter = (string) => {
        if (!string) return '';
        if (laminationRef.current && laminationRef.current.options && laminationRef.current.selectedIndex >= 0) {
            const text = laminationRef.current.options[laminationRef.current.selectedIndex].text;
            if (text) return text;
        }
        return string.charAt(0).toUpperCase() + string.slice(1);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setInputs(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleCheckboxChange = (id) => {
        setInputs(prev => ({

            
            ...prev,
            checkA: id === 'A' ? !prev.checkA : false,
            checkB: id === 'B' ? !prev.checkB : false,
            checkC: id === 'C' ? !prev.checkC : false
        }));
    };

    // --- HELPER FUNCTIONS ---
    const parseInputToInches = (input) => {
        if (!input) return 0;
        const strInput = String(input).trim().toLowerCase();
        if (strInput.endsWith('mm')) {
            const mmValue = parseFloat(strInput.slice(0, -2).trim());
            return isNaN(mmValue) ? 0 : mmValue / 25.4;
        }
        const inchValue = parseFloat(strInput);
        return isNaN(inchValue) ? 0 : inchValue;
    };

    

    useEffect(() => {
        const processesRequiringInputs = ['spotuv', 'raiseduv', 'stampfoil', 'magicfoil', 'spotuvbs', 'raiseduvbs', 'stampfoilbs', 'magicfoilbs'];
        setShowAdditionalProcessInputs(processesRequiringInputs.includes(inputs.additionalProcess));
    }, [inputs.additionalProcess]);

    useEffect(() => {
        const processesRequiringInputs = ['spotuv', 'raiseduv', 'stampfoil', 'magicfoil', 'spotuvbs', 'raiseduvbs', 'stampfoilbs', 'magicfoilbs'];
        setShowAdditionalProcess2Inputs(processesRequiringInputs.includes(inputs.additionalProcess2));
    }, [inputs.additionalProcess2]);

    useEffect(() => {
        setShowHalfCutting(inputs.fabricationN === 'halfcutting');
    }, [inputs.fabricationN]);

    useEffect(() => {
        if (inputs.paperType === 'hotmailsticker') {
            setInputs(prev => ({
                ...prev,
                gsm: 80,
                rate: 0, // Rate is not applicable for stickers
                printingType: 'oneside', // Default to a valid oneside option
                lamination: 'none' // Reset lamination
            }));
        }
    }, [inputs.paperType]);

    // Handle unsaved changes warning
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                const message = 'Please Save Quotation';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        };

        if (hasUnsavedChanges) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [hasUnsavedChanges]);

    // Intercept navigation attempts
    const handleNavigationAttempt = useCallback((callback) => {
        if (hasUnsavedChanges) {
            setPendingNavigation(() => callback);
            setShowSaveModal(true);
        } else {
            callback();
        }
    }, [hasUnsavedChanges]);

    const handleSaveAndContinue = () => {
        handleSave();
        setShowSaveModal(false);
        if (pendingNavigation) {
            setTimeout(() => {
                pendingNavigation();
                setPendingNavigation(null);
            }, 100);
        }
    };

    const handleSkipAndContinue = () => {
        setHasUnsavedChanges(false);
        setShowSaveModal(false);
        if (pendingNavigation) {
            pendingNavigation();
            setPendingNavigation(null);
        }
    };

    // Expose navigation handler to global scope
    useEffect(() => {
        window.currentComponentHasUnsavedChanges = hasUnsavedChanges ? handleNavigationAttempt : null;
        return () => {
            window.currentComponentHasUnsavedChanges = null;
        };
    }, [hasUnsavedChanges]);


    // --- CALCULATION LOGIC ---

    const getPrintingCostParams = () => {
        let baseCost = 1600, largeBaseCost = 2200, impressionCost = 400, largeImpressionCost = 500;
        if (inputs.checkA) { baseCost = 1250; largeBaseCost = 1250; }
        if (inputs.checkB) { baseCost = 1350; largeBaseCost = 1350; impressionCost = 360; largeImpressionCost = 360; }
        if (inputs.checkC) { baseCost = 1700; largeBaseCost = 1700; }
        return { baseCost, largeBaseCost, impressionCost, largeImpressionCost };
    };

    const getBasePrintCost = () => {
        const currentGsm = parseFloat(inputs.gsm) || 0;
        const currentQty = parseInt(inputs.qty) || 0;
        const currentNoOfLeaves = parseInt(inputs.noOfLeaves) || 1;
        let currentRate = parseFloat(inputs.rate) || 0;
        if (inputs.checkA) currentRate -= 3;
        if (inputs.checkB) currentRate -= 2;

        const parsedJobWidth = parseInputToInches(inputs.jobWidth);
        const parsedJobHeight = parseInputToInches(inputs.jobHeight);

        let bestFit = { cost: Infinity, sheet: null, ups: 0, totalPaperCost: 0, totalPrintingCost: 0, totalDripupCost: 0, grandTotalSheets: 0, printingMethods: [] };
        
        let fullSheets;
        if (inputs.reelcut) {
            fullSheets = [ { width: 19, height: 25.5 }, { width: 20, height: 30 }];
        } else if (inputs.paperType === "hotmailsticker") {
            fullSheets = [ { width: 18, height: 25 }, { width: 18, height: 23 }, { width: 15, height: 20 }, { width: 20, height: 30 } ];
        } else {
            fullSheets = [ { width: 18, height: 25 }, { width: 18, height: 23 }, { width: 15, height: 20 }, { width: 20, height: 30 }, { width: 12, height: 23 }, { width: 15, height: 25 }, { width: 12, height: 25 }, { width: 19, height: 25 }, { width: 20, height: 29.5 }, { width: 13, height: 26 }, { width: 14, height: 26 }, { width: 20, height: 28 } ];
        }

        const bleed = 0.1378;
        const adjustedWidth = parsedJobWidth + bleed;
        const adjustedHeight = parsedJobHeight + bleed;

        fullSheets.forEach((currentSheet) => {
            const trimInches = 4 / 25.4;
            const calculationHeight = (currentSheet.width === 20 && currentSheet.height === 30) ? 29.5 : currentSheet.height;
            let longSide = Math.max(currentSheet.width, calculationHeight) - trimInches;
            let shortSide = Math.min(currentSheet.width, calculationHeight);
            
            const isBothSides = inputs.printingType.includes('bothsides');
            
            let initialGripper = 0.7;
            let initialUsableShort = shortSide - initialGripper;
            const initial_ups1 = Math.floor(longSide / adjustedWidth) * Math.floor(initialUsableShort / adjustedHeight);
            const initial_ups2 = Math.floor(longSide / adjustedHeight) * Math.floor(initialUsableShort / adjustedWidth);
            const initialUps = Math.max(initial_ups1, initial_ups2);

            if (initialUps === 0) return;

            let printingMethodForRun = isBothSides ? 'frontback' : 'oneside';
            if (isBothSides) {
                const canBeSelfback = (initialUps % 4 === 0) || (initialUps === 2);
                const canBeDoubleGripper = (initialUps % 2 === 0);
                if (canBeSelfback && canBeDoubleGripper) {
                    const ups_long_side = (initial_ups1 > initial_ups2) ? Math.floor(longSide / adjustedWidth) : Math.floor(longSide / adjustedHeight);
                    if (ups_long_side % 2 !== 0) {
                        printingMethodForRun = 'doublegripper';
                    } else {
                        printingMethodForRun = 'selfback';
                    }
                } else if (canBeSelfback) {
                    printingMethodForRun = 'selfback';
                } else if (canBeDoubleGripper) {
                    printingMethodForRun = 'doublegripper';
                }
            }

            const finalGripper = printingMethodForRun === 'doublegripper' ? 1.1 : 0.7;
            const finalUsableShort = shortSide - finalGripper;
            const final_ups1 = Math.floor(longSide / adjustedWidth) * Math.floor(finalUsableShort / adjustedHeight);
            const final_ups2 = Math.floor(longSide / adjustedHeight) * Math.floor(finalUsableShort / adjustedWidth);
            const currentUps = Math.max(final_ups1, final_ups2);

            if (currentUps === 0) return;

            const colorType = inputs.printingType.endsWith('1') ? '1' : (inputs.printingType.endsWith('2') ? '2' : '');
            
            const isLargeFormatSheet = (currentSheet.width === 20 && (currentSheet.height === 30 || currentSheet.height === 29.5 || currentSheet.height === 28));
            const isSpecialColorJob = inputs.printingType.includes('1') || inputs.printingType.includes('2');
            if (isLargeFormatSheet && isSpecialColorJob) return;

            const getRunCost = (formSize, printingMethod) => {
                const sheetsNeeded = Math.ceil(currentQty * formSize);
                if (sheetsNeeded === 0) return { paperCost: 0, printingCost: 0, dripupCost: 0, totalSheets: 0 };
            
                let wastage = 0;
                if (sheetsNeeded <= 1500) wastage = 100; else if (sheetsNeeded <= 3000) wastage = 150; else if (sheetsNeeded <= 6000) wastage = 200;
                else if (sheetsNeeded <= 9000) wastage = 300; else if (sheetsNeeded <= 14000) wastage = 350; else if (sheetsNeeded <= 50000) wastage = 400; else wastage = 600;
            
                const totalSheetsForForm = sheetsNeeded + wastage;
            
                // Paper Cost Calculation (no changes here)
                let paperCostForForm = 0;
                let paperArea; 
                if (inputs.paperType === 'hotmailsticker') {
                    const hotmailStickerRates = { '18x23': 7, '18x25': 7.5, '20x30': 11, '15x20': 6 };
                    const sheetKey = `${currentSheet.width}x${currentSheet.height}`;
                    const sheetRate = hotmailStickerRates[sheetKey] || 0;
                    paperCostForForm = sheetRate * totalSheetsForForm;
                    paperArea = currentSheet.width * currentSheet.height;
                } else {
                    if (inputs.reelcut) {
                        const usedWidth = (final_ups1 > final_ups2) ? Math.floor(longSide / adjustedWidth) * adjustedWidth : Math.floor(longSide / adjustedHeight) * adjustedHeight;
                        const usedHeight = (final_ups1 > final_ups2) ? Math.floor(finalUsableShort / adjustedHeight) * adjustedHeight : Math.floor(finalUsableShort / adjustedWidth) * adjustedWidth;
                        paperArea = (usedWidth + 0.75) * (usedHeight + 0.75);
                    } else if (currentSheet.width === 19 && currentSheet.height === 25) {
                        paperArea = sheetsNeeded < 2700 ? 600 : 475;
                    } else if (currentSheet.width === 20 && currentSheet.height === 28) {
                        paperArea = sheetsNeeded < 2700 ? 600 : 560;
                    } else if ((currentSheet.width === 13 && currentSheet.height === 26) || (currentSheet.width === 14 && currentSheet.height === 26)) {
                        paperArea = 400;
                    } else {
                        paperArea = currentSheet.width * currentSheet.height;
                    }
                    const paperWeightForForm = (paperArea * currentGsm * totalSheetsForForm) / (1550000);
                    paperCostForForm = paperWeightForForm * currentRate;
                }
            
                // --- UPDATED PRINTING COST LOGIC ---
                let printingCostForForm = 0;
                const rounds = Math.ceil(sheetsNeeded / 1000);
                const rounds2 = Math.ceil(sheetsNeeded * 2 / 1000);
                let { baseCost, largeBaseCost, impressionCost, largeImpressionCost } = getPrintingCostParams();
            
                if (currentSheet.width === 20 && currentSheet.height === 28) {
                    largeBaseCost = 2700;
                    largeImpressionCost = 500;
                }
            
                // Check if it's a NEW direct Pantone job first
                if (inputs.printingType.startsWith('pantone_')) {
                    if (isLargeFormatSheet) {
                        switch (inputs.printingType) {
                            case "pantone_cmyk_bs": printingCostForForm = rounds2 * 800 + 4000; break;
                            case "pantone_cmyk_os": printingCostForForm = rounds * 800 + 4000; break;
                            case "pantone_bs": printingCostForForm = rounds2 * 700 + 4500; break;
                            case "pantone_os": printingCostForForm = rounds * 700 + 4500; break;
                        }
                    } else { // Regular sheet size
                        switch (inputs.printingType) {
                            case "pantone_cmyk_bs": printingCostForForm = rounds2 * 600 + 3500; break;
                            case "pantone_cmyk_os": printingCostForForm = rounds * 600 + 3500; break;
                            case "pantone_bs": printingCostForForm = rounds2 * 500 + 3000; break;
                            case "pantone_os": printingCostForForm = rounds * 500 + 3000; break;
                        }
                    }
                } 
                // Otherwise, use the ORIGINAL logic for CMYK, 1-color, and 2-color jobs
                else {
                    const colorType = inputs.printingType.endsWith('1') ? '1' : (inputs.printingType.endsWith('2') ? '2' : '');
                    const methodForCosting = printingMethod + colorType;
            
                    if (isLargeFormatSheet) {
                        switch (methodForCosting) {
                            case "selfback": case "doublegripper": printingCostForForm = rounds2 * largeImpressionCost + largeBaseCost; break;
                            case "frontback": printingCostForForm = (rounds * largeImpressionCost + largeBaseCost) * 2; break;
                            case "oneside": printingCostForForm = rounds * largeImpressionCost + largeBaseCost; break;
                        }
                    } else {
                        switch (methodForCosting) {
                            // --- Standard CMYK (Regular) ---
                            case "selfback": case "doublegripper": printingCostForForm = rounds2 * impressionCost + baseCost; break;
                            case "frontback": printingCostForForm = (rounds * impressionCost + baseCost) * 2; break;
                            case "oneside": printingCostForForm = rounds * impressionCost + baseCost; break;
                            
                            // --- 2-Color (Regular) ---
                            case "selfback2": case "doublegripper2": printingCostForForm = rounds2 * 200 + 600; break;
                            case "frontback2": printingCostForForm = (rounds * 200 + 600) * 2; break;
                            case "oneside2": printingCostForForm = rounds * 200 + 600; break;
                            
                            // --- 1-Color (Regular) ---
                            case "selfback1": case "doublegripper1": printingCostForForm = rounds2 * 150 + 450; break;
                            case "frontback1": printingCostForForm = (rounds * 150 + 450) * 2; break;
                            case "oneside1": printingCostForForm = rounds * 150 + 450; break;
                        }
                    }
                }
            
                let dripupCostForForm = 0;
                if (inputs.additionalProcess === 'dripup' || inputs.additionalProcess2 === 'dripup') {
                    let dripupCost = (totalSheetsForForm <= 6000) ? (paperArea * 0.85 * totalSheetsForForm) / 100 + 600 : (paperArea * 0.75 * totalSheetsForForm) / 100 + 600;
                    dripupCostForForm = Math.max(dripupCost, 6000);
                }
            
                return { paperCost: paperCostForForm, printingCost: printingCostForForm, dripupCost: dripupCostForForm, totalSheets: totalSheetsForForm };
            };
            
            const runs = [];
            if (currentNoOfLeaves === 1) {
                runs.push({ formSize: 1 / currentUps, method: printingMethodForRun });
            } else {
                const fullFormsCount = Math.floor(currentNoOfLeaves / currentUps);
                const remainingLeaves = currentNoOfLeaves % currentUps;

                const fullFormMethod = isBothSides ? 'frontback' : 'oneside';
                
                for (let i = 0; i < fullFormsCount; i++) {
                    runs.push({ formSize: 1, method: fullFormMethod });
                }

                if (remainingLeaves > 0) {
                    const decimalPart = remainingLeaves / currentUps;
                    
                    if (decimalPart > 0.5 && isBothSides) {
                        // --- Scenario 1: Decompose the decimal into standard runs (0.5, 0.25, 0.125) ---
                        const formSizesForSplitRun = [];
                        let tempDecimal = decimalPart;

                        if (tempDecimal >= 0.5) {
                            formSizesForSplitRun.push(0.5);
                            tempDecimal -= 0.5;
                        }
                        if (tempDecimal >= 0.25) {
                            formSizesForSplitRun.push(0.25);
                            tempDecimal -= 0.25;
                        }
                        if (tempDecimal > 0) {
                             if (tempDecimal <= 0.125) {
                                formSizesForSplitRun.push(0.125);
                            } else if (tempDecimal <= 0.25){
                                formSizesForSplitRun.push(0.25);
                            }
                        }

                        const totalCost_Scenario1 = formSizesForSplitRun.reduce((total, size) => {
                            const runCost = getRunCost(size, printingMethodForRun);
                            return total + runCost.paperCost + runCost.printingCost + runCost.dripupCost;
                        }, 0);

                        // --- Scenario 2: Round-up Run ---
                        const scenarioB_Method = isBothSides ? 'frontback' : 'oneside';
                        const run_B = getRunCost(1.0, scenarioB_Method);
                        const totalCost_Scenario2 = run_B.paperCost + run_B.printingCost + run_B.dripupCost;

                        // --- Compare scenarios and add the winning set of runs ---
                        if (totalCost_Scenario1 < totalCost_Scenario2) {
                            formSizesForSplitRun.forEach(size => {
                                runs.push({ formSize: size, method: printingMethodForRun });
                            });
                        } else {
                            runs.push({ formSize: 1.0, method: scenarioB_Method });
                        }

                    } else {
                        let formSizeToRun;
                        if (decimalPart < 0.125) formSizeToRun = decimalPart;
                        else if (decimalPart <= 0.25) formSizeToRun = 0.25;
                        else if (decimalPart <= 0.5) formSizeToRun = 0.5;
                        else formSizeToRun = 1.0;
                        runs.push({ formSize: formSizeToRun, method: printingMethodForRun });
                    }
                }
            }

            const runDetails = runs.map(run => {
                const res = getRunCost(run.formSize, run.method);
                return {
                    method: run.method,
                    sheets: res.totalSheets,
                    paperCost: res.paperCost,
                    printingCost: res.printingCost,
                    dripupCost: res.dripupCost
                };
            }).filter(run => run.sheets > 0);

            const finalRunDetails = runDetails;

            const totalPaperCost = finalRunDetails.reduce((sum, run) => sum + run.paperCost, 0);
            const totalPrintingCost = finalRunDetails.reduce((sum, run) => sum + run.printingCost, 0);
            const totalDripupCost = finalRunDetails.reduce((sum, run) => sum + run.dripupCost, 0);
            const grandTotalSheets = finalRunDetails.reduce((sum, run) => sum + run.sheets, 0);
            const totalCost = totalPaperCost + totalPrintingCost + totalDripupCost;

            if (totalCost < bestFit.cost) {
                bestFit = {
                    cost: totalCost,
                    sheet: currentSheet,
                    ups: currentUps,
                    totalPaperCost,
                    totalPrintingCost,
                    totalDripupCost,
                    grandTotalSheets,
                    runDetails: finalRunDetails
                };
            }
      });
      return bestFit;
    };

    const getPostPressCosts = (baseCost) => {
        const currentQty = parseInt(inputs.qty) || 0;
        const currentNoOfLeaves = parseInt(inputs.noOfLeaves) || 1;
        
        let lamCost = 0;
        if (baseCost.sheet) {
            const lamArea = baseCost.sheet.width * baseCost.sheet.height;
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
            }
        }

        let punchCost = 0;
        if (inputs.punching === "yes") punchCost = Math.ceil(baseCost.grandTotalSheets / 1000) * 400;
        else if (inputs.punching === "stickerpunching") punchCost = Math.ceil(baseCost.grandTotalSheets / 1000) * 800;

        const totalItemQty = currentQty * currentNoOfLeaves;
        let fabricationCost = 0, fabRate = 0;
        if (baseCost.sheet) {
            const lamArea = baseCost.sheet.width * baseCost.sheet.height;
            switch (inputs.fabrication) {
                case "singlefold": fabRate = 100; break; case "multifold": fabRate = 150; break; case "cardfolding": fabRate = 300; break; case "threading": fabRate = 300; break;
                case "pouch": fabRate = 750; break; case "box": fabRate = 600; break; case "tentcard": fabRate = 400; break; case "wobler": fabRate = 1300; break;
                case "fullgumming": fabricationCost = (lamArea * 1.5 * baseCost.grandTotalSheets) / 100; break;
                case "lockbottom": fabricationCost = Math.ceil(totalItemQty / 1000) * 600; break;
                case "selflock": fabricationCost = Math.ceil(totalItemQty / 1000) * 400; break;
            }
        }
        if (fabRate > 0) fabricationCost = Math.ceil(currentQty / 1000) * fabRate * currentNoOfLeaves;
        
        let fabricationCostN = 0, fabRateN = 0;
         if (baseCost.sheet) {
            const lamArea = baseCost.sheet.width * baseCost.sheet.height;
            switch (inputs.fabricationN) {
                case "singlefoldN": fabRateN = 100; break; case "multifoldN": fabRateN = 150; break; case "cardfoldingN": fabRateN = 300; break; case "threadingN": fabRateN = 300; break;
                case "pouchN": fabRateN = 750; break; case "boxN": fabRateN = 600; break; case "tentcardN": fabRateN = 400; break; case "woblerN": fabRateN = 1300; break;
                case "fullgummingN": fabricationCostN = (lamArea * 1.5 * baseCost.grandTotalSheets) / 100; break;
                case "lockbottomN": fabricationCostN = Math.ceil(totalItemQty / 1000) * 600; break;
                case "selflockN": fabricationCostN = Math.ceil(totalItemQty / 1000) * 400; break;
            }
        }
        if (fabRateN > 0) fabricationCostN = Math.ceil(currentQty / 1000) * fabRateN * currentNoOfLeaves;

        const k3_sheets = Math.ceil(baseCost.grandTotalSheets / 1000);
        const getAdditionalCost = (processValue, width, height, itemQty) => {
            if (processValue === '0' || processValue === 'dripup') return 0;
            let oldCost = 0, newCost = 0;
            switch (processValue) {
                case "spotuv": oldCost = k3_sheets * 1500; break; case "raiseduv": oldCost = k3_sheets * 2500; break;
                case "stampfoil": oldCost = k3_sheets * 2000 + 2000; break; case "magicfoil": oldCost = k3_sheets * 8000; break;
                case "spotuvbs": oldCost = k3_sheets * 3000; break; case "raiseduvbs": oldCost = k3_sheets * 5000; break;
                case "stampfoilbs": oldCost = k3_sheets * 4000 + 4000; break; case "magicfoilbs": oldCost = k3_sheets * 16000; break;
            }
            if (width > 0 && height > 0) {
                const area = width * height;
                switch (processValue) {
                    case "spotuv": case "stampfoil": newCost = area * itemQty * 0.03; break; case "spotuvbs": case "stampfoilbs": newCost = area * itemQty * 0.055; break;
                    case "raiseduv": newCost = area * itemQty * 0.04; break; case "raiseduvbs": newCost = area * itemQty * 0.06; break;
                    case "magicfoil": newCost = area * itemQty * 0.065; break; case "magicfoilbs": newCost = area * itemQty * 0.13; break;
                }
            }
            return Math.max(oldCost, newCost);
        };
        
        let additionalProcessCost = getAdditionalCost(inputs.additionalProcess, parseInputToInches(inputs.additionalProcessWidth), parseInputToInches(inputs.additionalProcessHeight), totalItemQty);
        let additionalProcessCost2 = getAdditionalCost(inputs.additionalProcess2, parseInputToInches(inputs.additionalProcess2Width), parseInputToInches(inputs.additionalProcess2Height), totalItemQty);
        
        let halfcuttingAmt = 0;
        if (inputs.fabricationN === 'halfcutting' && inputs.hcut > 0 && inputs.wcut > 0 && inputs.ups > 0 && baseCost.grandTotalSheets > 0) {
            let hcRate = (currentQty > 10000) ? 0.06 : 0.07;
            halfcuttingAmt = (parseFloat(inputs.wcut) + parseFloat(inputs.hcut)) * hcRate * parseFloat(inputs.ups) * baseCost.grandTotalSheets;
            if (halfcuttingAmt > 0 && halfcuttingAmt < 500) halfcuttingAmt = 500;
        }

        return { lamCost, dieCost: parseFloat(inputs.dieType), punchCost, fabricationCost, fabricationCostN, additionalProcessCost, additionalProcessCost2, halfcuttingAmt };
    };


    // --- EVENT HANDLERS ---
    
    const handleSave = () => {
        if (result.length === 0) {
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

        const paperTypeText = paperTypeRef.current?.options[paperTypeRef.current.selectedIndex]?.text || inputs.paperType;
        const laminationText = laminationRef.current?.options[laminationRef.current.selectedIndex]?.text || inputs.lamination;

        const quotationData = {
            productType: 'CutToSheet',
            serial: formData && formData.serial ? formData.serial : getNextSerial(),
            customerName: inputs.customerName,
            inputs: {
                ...inputs,
                paperTypeText,
                laminationText,
            },
            results: result,
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
            setHasUnsavedChanges(false);
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

    const handleCalculate = () => {
        const requiredFields = {
            customerName: 'Customer Name',
            paperType: 'Paper Type',
            qty: 'Quantity',
            jobWidth: 'Job Width',
            jobHeight: 'Job Height',
            gsm: 'GSM',
            printingType: 'Printing'
        };

        if (inputs.paperType !== 'hotmailsticker') {
            requiredFields.rate = 'Rate';
        }

        const missingFields = Object.entries(requiredFields)
            .filter(([key, label]) => {
                const value = inputs[key];
                return !value || value === '0';
            })
            .map(([, value]) => value);

        if (missingFields.length > 0) {
            setError(`Please provide a valid value (not 0) for: ${missingFields.join(', ')}`);
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

        // Validation for Additional Processes
        if (showAdditionalProcessInputs && (!inputs.additionalProcessWidth || !inputs.additionalProcessHeight)) {
            setError('Please provide Width and Height for Additional Process 1.');
            return;
        }
        if (showAdditionalProcess2Inputs && (!inputs.additionalProcess2Width || !inputs.additionalProcess2Height)) {
            setError('Please provide Width and Height for Additional Process 2.');
            return;
        }


        setError('');
        const baseCost = getBasePrintCost();
        const currentQty = parseInt(inputs.qty) || 0;

        if (baseCost.cost === Infinity || !baseCost.sheet) {
            setError('Could not find a viable printing option. Please check job dimensions.');
            setResult([]);
            setBestFitDetails(null);
            return;
        }
        
        setBestFitDetails({ sheet: baseCost.sheet, ups: baseCost.ups, grandTotalSheets: baseCost.grandTotalSheets, runDetails: baseCost.runDetails });

        const postPressCosts = getPostPressCosts(baseCost);
        const totalCost = baseCost.totalPaperCost + baseCost.totalPrintingCost + baseCost.totalDripupCost + postPressCosts.lamCost + postPressCosts.dieCost + postPressCosts.punchCost + postPressCosts.fabricationCost + postPressCosts.fabricationCostN + postPressCosts.additionalProcessCost + postPressCosts.additionalProcessCost2 + postPressCosts.halfcuttingAmt;
        const currentNoOfLeaves = parseInt(inputs.noOfLeaves) || 1;
        const finalRate = currentQty > 0 ? totalCost / (currentQty * currentNoOfLeaves) : 0;
        
        const newResult = {
            qty: currentQty,
            noOfLeaves: inputs.noOfLeaves,
            jobWidth: inputs.jobWidth,
            jobHeight: inputs.jobHeight,
            gsm: inputs.gsm,
            paperType: inputs.paperType,
            paperTypeText: paperTypeRef.current?.options[paperTypeRef.current.selectedIndex]?.text || inputs.paperType,
            printingType: inputs.printingType,
            lamination: inputs.lamination,
            laminationText: laminationRef.current?.options[laminationRef.current.selectedIndex]?.text || inputs.lamination,
            dieType: inputs.dieType,
            dieTypeText: dieTypeRef.current?.options[dieTypeRef.current.selectedIndex]?.text || inputs.dieType,
            punching: inputs.punching,
            punchingText: punchingRef.current?.options[punchingRef.current.selectedIndex]?.text || inputs.punching,
            fabrication: inputs.fabrication,
            fabricationText: fabricationRef.current?.options[fabricationRef.current.selectedIndex]?.text || inputs.fabrication,
            fabricationN: inputs.fabricationN,
            fabricationNText: fabricationNRef.current?.options[fabricationNRef.current.selectedIndex]?.text || inputs.fabricationN,
            additionalProcess: inputs.additionalProcess,
            additionalProcess2: inputs.additionalProcess2,
            checkA: inputs.checkA,
            checkB: inputs.checkB,
            checkC: inputs.checkC,
            reelcut: inputs.reelcut,
            totalCost,
            finalRate,
            baseCost,
            postPressCosts,
            bestFitDetails: { sheet: baseCost.sheet, ups: baseCost.ups, grandTotalSheets: baseCost.grandTotalSheets, runDetails: baseCost.runDetails }
        };

        setResult(prevResult => {
            setHasUnsavedChanges(true);
            return [...prevResult, newResult];
        });
    };

    const handleAdjustment = (direction) => {
        const percentage = parseFloat(adjustmentPercentage) || 0;
        if (percentage === 0) return;

        const multiplier = direction === 'add' ? (1 + percentage / 100) : (1 - percentage / 100);

        setResult(prevResult => prevResult.map(r => {
            const newTotalCost = r.totalCost * multiplier;
            const newFinalRate = newTotalCost / (r.qty * r.noOfLeaves);
            return { ...r, totalCost: newTotalCost, finalRate: newFinalRate };
        }));
    };

    const handleAmountAdjustment = (direction) => {
        const amount = parseFloat(adjustmentAmount) || 0;
        if (amount === 0) return;

        const adjustment = direction === 'add' ? amount : -amount;

        setResult(prevResult => prevResult.map(r => {
            const newTotalCost = r.totalCost + adjustment;
            const newFinalRate = newTotalCost / (r.qty * r.noOfLeaves);
            return { ...r, totalCost: newTotalCost, finalRate: newFinalRate };
        }));
    };

    const handleDeleteResult = (index) => {
        const newResult = result.filter((_, i) => i !== index);
        if (newResult.length === 0) {
            setBestFitDetails(null);
            setHasUnsavedChanges(false);
        }
        setResult(newResult);
    };



    return (
        <div className={`cuttosheet-flex-container ${result.length > 0 ? 'results-visible' : ''}`}>
            <div className="cuttosheet-box cuttosheet-form-box">
                <h1 className="form-title-pink">Cut to Sheet Quotation</h1>
                <form className="cut-to-sheet-form" onSubmit={e => e.preventDefault()}>
                    <div className="form-grid-modern">
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                            <div style={{ flexGrow: 1 }}>
                                <label className="input-label" htmlFor="customerName">Customer Name</label>
                                <select id="customerName" name="customerName" className="input-box" value={inputs.customerName} onChange={handleInputChange}>
                                    <option value="">-- Select Customer --</option>
                                    {customers.sort((a, b) => (a.customerName || '').localeCompare(b.customerName || '')).map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
                                </select>
                            </div>
                            <button type="button" className="save-btn-modern" style={{ padding: '10px 15px', fontSize: '1.2rem', lineHeight: 1 }} onClick={() => onNavigate('Customer Master')}>+
                            </button>
                        </div>
                        <FormSelect label="Paper Type" id="paperType" name="paperType" ref={paperTypeRef} value={inputs.paperType} onChange={(e) => {
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
                        }} required>
                            <option value="">Select Paper</option>
                            {paperTypes.map(p => <option key={p.id} value={p.paperTypeName}>{p.paperTypeName}</option>)}
                        </FormSelect>
                        <FormInput label="Quantity" id="qty" name="qty" type="number" value={inputs.qty} onChange={handleInputChange} placeholder="e.g., 1000" required/>
                        <FormInput label="No of Leaves/Design" id="noOfLeaves" name="noOfLeaves" type="number" value={inputs.noOfLeaves} onChange={handleInputChange} placeholder="e.g., 1"/>
                        <FormInput label="Job Width (inch/mm)" id="jobWidth" name="jobWidth" type="text" value={inputs.jobWidth} onChange={handleInputChange} placeholder="e.g., 8.5 or 210mm" required/>
                        <FormInput label="Job Height (inch/mm)" id="jobHeight" name="jobHeight" type="text" value={inputs.jobHeight} onChange={handleInputChange} placeholder="e.g., 11 or 297mm" required/>
                        <FormInput label="GSM" id="gsm" name="gsm" type="number" value={inputs.gsm} onChange={(e) => {
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
                        }} placeholder="e.g., 300" required/>
                        {inputs.paperType !== 'hotmailsticker' && (
                            <FormInput label="Rate" id="rate" name="rate" type="number" value={inputs.rate} onChange={handleInputChange} required/>
                        )}
                        <FormSelect label="Printing" id="printingType" name="printingType" value={inputs.printingType} onChange={handleInputChange} required>
                            {inputs.paperType === 'hotmailsticker' ? (
                                <>
                                    <option value="oneside">One Side (4+0 Color)</option>
                                    <option value="oneside2">One Side (2+0 Color)</option>
                                    <option value="oneside1">One Side (1+0 Color)</option>
                                    <option value="pantone_cmyk_os">Pantone+CMYK O/S</option>
                                    <option value="pantone_os">Pantone O/S</option>
                                </>
                            ) : (
                                <>
                                    {/* --- Standard CMYK Options --- */}
                                    <option value="bothsides">Both Sides (4+4 Color)</option>
                                    <option value="oneside">One Side (4+0 Color)</option>
                                    
                                    {/* --- Old 1 & 2 Color Options --- */}
                                    <option value="bothsides2">Both Sides (2+2 Color)</option>
                                    <option value="oneside2">One Side (2+0 Color)</option>
                                    <option value="bothsides1">Both Sides (1+1 Color)</option>
                                    <option value="oneside1">One Side (1+0 Color)</option>

                                    {/* --- New Explicit Pantone Options --- */}
                                    <option value="pantone_cmyk_bs">Pantone+CMYK B/S</option>
                                    <option value="pantone_cmyk_os">Pantone+CMYK O/S</option>
                                    <option value="pantone_bs">Pantone B/S</option>
                                    <option value="pantone_os">Pantone O/S</option>
                                </>
                            )}
                        </FormSelect>
                        <FormSelect label="Lamination / Varnish" id="lamination" name="lamination" ref={laminationRef} value={inputs.lamination} onChange={handleInputChange}>
                            <option value="none">None</option>
                            <option value="mattos">Matt Lamination O/S</option>
                            <option value="glossos">Gloss Lamination O/S</option>
                            <option value="varnishos">Varnish O/S</option>
                            <option value="thermattos">Thermal Lamination O/S</option>
                            <option value="velmattos">Velvet Matt Lamination O/S</option>
                            {inputs.paperType !== 'hotmailsticker' && (
                                <>
                                    <option value="mattbs">Matt Lamination B/S</option>
                                    <option value="glossbs">Gloss Lamination B/S</option>
                                    <option value="varnishbs">Varnish B/S</option>
                                    <option value="thermattbs">Thermal Lamination B/S</option>
                                    <option value="velmattbs">Velvet Matt Lamination B/S</option>
                                </>
                            )}
                        </FormSelect>
                    </div>
                    <div className="flex justify-center my-4">
                        <div className="flex flex-col items-center gap-4">
                            <button 
                                type="button" 
                                onClick={() => setShowAdditionalProcesses(!showAdditionalProcesses)} 
                                className="save-btn-modern text-sm py-1 px-4"
                                onKeyDown={(e) => {
                                    if (e.key === 'Tab' && !e.shiftKey) {
                                        e.preventDefault();
                                        calculateBtnRef.current.focus();
                                    }
                                }}
                            >
                                Additional Processes {showAdditionalProcesses ? '▲' : '▼'}
                            </button>
                        </div>
                    </div>
                    {showAdditionalProcesses && (
                        <div className="form-grid-modern">
                            <FormSelect label="Die" id="dieType" name="dieType" ref={dieTypeRef} value={inputs.dieType} onChange={handleInputChange}>
                                <option value="0">None</option>
                                <option value="1500">Small-Punch</option>
                                <option value="2000">Medium-Punch</option>
                                <option value="3000">Big-Punch</option>
                            </FormSelect>
                            <FormSelect label="Punching" id="punching" name="punching" ref={punchingRef} value={inputs.punching} onChange={handleInputChange}>
                                <option value="none">None</option>
                                <option value="yes">Yes</option>
                                <option value="stickerpunching">Sticker Punching</option>
                            </FormSelect>
                            <FormSelect label="Fabrication" id="fabrication" name="fabrication" ref={fabricationRef} value={inputs.fabrication} onChange={handleInputChange}>
                                <option value="0">None</option>
                                <option value="singlefold">Single fold</option>
                                <option value="multifold">Multi fold</option>
                                <option value="cardfolding">Card folding</option>
                                <option value="threading">Threading</option>
                                <option value="pouch">Pouch Pasting</option>
                                <option value="box">Box Pasting</option>
                                <option value="wobler">Wobler</option>
                                <option value="tentcard">Tent Card Pasting</option>
                                <option value="fullgumming">Full Gumming</option>
                                <option value="lockbottom">Lock Bottom & Side Pasting</option>
                                <option value="selflock">Self lock Side Pasting</option>
                            </FormSelect>
                            <FormSelect label="Fabrication 2" id="fabricationN" name="fabricationN" ref={fabricationNRef} value={inputs.fabricationN} onChange={handleInputChange}>
                                <option value="0">None</option>
                                <option value="singlefoldN">Single fold</option>
                                <option value="multifoldN">Multi fold</option>
                                <option value="cardfoldingN">Card folding</option>
                                <option value="threadingN">Threading</option>
                                <option value="pouchN">Pouch Pasting</option>
                                <option value="boxN">Box Pasting</option>
                                <option value="woblerN">Wobler</option>
                                <option value="halfcutting">Half Cutting</option>
                                <option value="tentcardN">Tent Card Pasting</option>
                                <option value="fullgummingN">Full Gumming</option>
                                <option value="lockbottomN">Lock Bottom & Side Pasting</option>
                                <option value="selflockN">Self lock Side Pasting</option>
                            </FormSelect>
                            {showHalfCutting && (
                                <>
                                    <FormInput label="H-Cut" id="hcut" name="hcut" type="number" value={inputs.hcut} onChange={handleInputChange} />
                                    <FormInput label="W-Cut" id="wcut" name="wcut" type="number" value={inputs.wcut} onChange={handleInputChange} />
                                    <FormInput label="Ups" id="ups" name="ups" type="number" value={inputs.ups} onChange={handleInputChange} />
                                </>
                            )}
                            <FormSelect label="Additional Process 1" id="additionalProcess" name="additionalProcess" value={inputs.additionalProcess} onChange={handleInputChange}>
                                <option value="0">None</option>
                                <option value="dripup">Drip Up</option>
                                <option value="spotuv">Spot UV</option>
                                <option value="raiseduv">Raised UV</option>
                                <option value="stampfoil">Stamp Foiling</option>
                                <option value="magicfoil">Magic Foil</option>
                                <option value="spotuvbs">Spot UV BS</option>
                                <option value="raiseduvbs">Raised UV BS</option>
                                <option value="stampfoilbs">Stamp Foiling BS</option>
                                <option value="magicfoilbs">Magic Foil BS</option>
                            </FormSelect>
                            {showAdditionalProcessInputs && (
                                <>
                                    <FormInput label="Width (inch/mm)" id="additionalProcessWidth" name="additionalProcessWidth" type="text" value={inputs.additionalProcessWidth} onChange={handleInputChange} required />
                                    <FormInput label="Height (inch/mm)" id="additionalProcessHeight" name="additionalProcessHeight" type="text" value={inputs.additionalProcessHeight} onChange={handleInputChange} required />
                                </>
                            )}
                            <FormSelect label="Additional Process 2" id="additionalProcess2" name="additionalProcess2" value={inputs.additionalProcess2} onChange={handleInputChange}>
                                <option value="0">None</option>
                                <option value="dripup">Drip Up</option>
                                <option value="spotuv">Spot UV</option>
                                <option value="raiseduv">Raised UV</option>
                                <option value="stampfoil">Stamp Foiling</option>
                                <option value="magicfoil">Magic Foil</option>
                                <option value="spotuvbs">Spot UV BS</option>
                                <option value="raiseduvbs">Raised UV BS</option>
                                <option value="stampfoilbs">Stamp Foiling BS</option>
                                <option value="magicfoilbs">Magic Foil BS</option>
                            </FormSelect>
                            {showAdditionalProcess2Inputs && (
                                <>
                                    <FormInput label="Width (inch/mm)" id="additionalProcess2Width" name="additionalProcess2Width" type="text" value={inputs.additionalProcess2Width} onChange={handleInputChange} required />
                                    <FormInput label="Height (inch/mm)" id="additionalProcess2Height" name="additionalProcess2Height" type="text" value={inputs.additionalProcess2Height} onChange={handleInputChange} required />
                                </>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col items-center mt-8 gap-4">
                        <div className="checkbox-grid justify-center">
                            <Checkbox id="checkA" label="A" checked={inputs.checkA} onChange={() => handleCheckboxChange('A')} />
                            <Checkbox id="checkB" label="B" checked={inputs.checkB} onChange={() => handleCheckboxChange('B')} />
                            <Checkbox id="checkC" label="C" checked={inputs.checkC} onChange={() => handleCheckboxChange('C')} />
                            <Checkbox id="reelcut" name="reelcut" label="Reel Cut" checked={inputs.reelcut} onChange={handleInputChange} />
                        </div>
                        <button ref={calculateBtnRef} type="button" onClick={handleCalculate} className="save-btn-modern py-3 px-8 text-lg">Calculate</button>
                    </div>
                </form>
                <Modal show={!!error} onClose={() => setError('')}>
                    <div className="error-message-container">
                        <p className="text-lg font-semibold">{error}</p>
                    </div>
                </Modal>
                
                <Modal show={showSaveModal} onClose={() => setShowSaveModal(false)}>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '20px', color: '#374151' }}>Unsaved Changes</h3>
                        <p style={{ marginBottom: '30px', color: '#6B7280' }}>You have unsaved quotation results. Do you want to save before leaving?</p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={handleSaveAndContinue} className="save-btn-modern" style={{ padding: '10px 20px' }}>Save</button>
                            <button onClick={handleSkipAndContinue} className="delete-btn-modern" style={{ padding: '10px 20px' }}>Skip</button>
                        </div>
                    </div>
                </Modal>
            </div>
            {result.length > 0 && (
                <div className="cuttosheet-box cuttosheet-result-box">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">Quotation Details</h3>
                    
                    {/* Quotation Details Table */}
                    <div className="overflow-x-auto mb-4">
                        <table className="result-table-modern compact-table">
                            <thead>
                                <tr>
                                    <th>Quotation - {formData && formData.serial ? formData.serial : getNextSerial()}</th>
                                    {result.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Quantity</td>
                                    {result.map((r, i) => <td key={i}>{r.qty}</td>)}
                                </tr>
                                {result.some(r => r.noOfLeaves > 1) && (
                                    <tr>
                                        <td>Leaves/Designs</td>
                                        {result.map((r, i) => <td key={i}>{r.noOfLeaves}</td>)}
                                    </tr>
                                )}
                                <tr>
                                    <td>Size</td>
                                    {result.map((r, i) => <td key={i}>{`${r.jobWidth}" x ${r.jobHeight}"`}</td>)}
                                </tr>
                                <tr>
                                    <td>GSM</td>
                                    {result.map((r, i) => <td key={i}>{r.gsm} GSM {r.paperTypeText || inputs.paperType}</td>)}
                                </tr>
                                <tr>
                                    <td>Printing</td>
                                    {result.map((r, i) => <td key={i}>{r.printingType.replace('bothsides', 'Both Sides').replace('oneside', 'One Side')}</td>)}
                                </tr>
                                {result.some(r => r.lamination !== 'none') && (
                                    <tr>
                                        <td>Lamination</td>
                                        {result.map((r, i) => <td key={i}>{r.laminationText}</td>)}
                                    </tr>
                                )}
                                {result.some(r => r.dieType !== '0') && (
                                    <tr>
                                        <td>Die</td>
                                        {result.map((r, i) => <td key={i}>{r.dieTypeText}</td>)}
                                    </tr>
                                )}
                                {result.some(r => r.punching !== 'none') && (
                                    <tr>
                                        <td>Punching</td>
                                        {result.map((r, i) => <td key={i}>{r.punchingText}</td>)}
                                    </tr>
                                )}
                                {result.some(r => r.fabrication !== '0') && (
                                    <tr>
                                        <td>Fabrication</td>
                                        {result.map((r, i) => <td key={i}>{r.fabricationText}</td>)}
                                    </tr>
                                )}
                                {result.some(r => r.fabricationN !== '0') && (
                                    <tr>
                                        <td>Fabrication 2</td>
                                        {result.map((r, i) => <td key={i}>{r.fabricationNText}</td>)}
                                    </tr>
                                )}
                                {result.some(r => r.additionalProcess !== '0') && (
                                    <tr>
                                        <td>Addon 1</td>
                                        {result.map((r, i) => <td key={i}>{additionalProcessMap[r.additionalProcess]}</td>)}
                                    </tr>
                                )}
                                {result.some(r => r.additionalProcess2 !== '0') && (
                                    <tr>
                                        <td>Addon 2</td>
                                        {result.map((r, i) => <td key={i}>{additionalProcessMap[r.additionalProcess2]}</td>)}
                                    </tr>
                                )}
                                <tr>
                                    <td style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>Total Amt</td>
                                    {result.map((r, i) => <td key={i} style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>₹{r.totalCost.toFixed(2)}</td>)}
                                </tr>
                                <tr>
                                    <td style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>Rate</td>
                                    {result.map((r, i) => <td key={i} style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>₹{r.finalRate.toFixed(2)}</td>)}
                                </tr>
                                <tr>
                                    <td>Action</td>
                                    {result.map((r, i) => <td key={i}><button onClick={() => handleDeleteResult(i)} className="delete-btn-modern">-</button></td>)}
                                </tr>
                            </tbody>
                        </table>
                    </div>



                    <div className="terms-and-conditions mt-6 mb-6">
                        <h4 className="text-lg font-semibold mb-3 text-gray-700">Terms & Conditions</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                            <li>Packing and Boxes Charges will be extra, (only patti packing free)</li>
                            <li>Delivery Charges will be Additional</li>
                            <li>GST Extra Applicable</li>
                        </ul>
                    </div>

                    <div className="mt-4 flex gap-4 justify-center">
                        <button type="button" onClick={handleSave} className="save-btn-modern py-3 px-8 text-lg" disabled={isSaving}>
                            {isSaving ? 'Saving...' : (formData ? 'Update Quotation' : 'Save Quotation')}
                        </button>
                        {hasUnsavedChanges && (
                            <p style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '10px', textAlign: 'center' }}>
                                * You have unsaved changes
                            </p>
                        )}
                    </div>
                    {saveSuccess && <p className="text-green-600 mt-2 text-center">{saveSuccess}</p>}

                    {/* Rate Adjustment */}
                    <div className="flex items-center justify-center my-4 gap-4 p-4 border-t border-gray-200">
                        <div className="flex flex-col items-center gap-2">
                            <label htmlFor="adjustmentPercentage" className="input-label">Percentile Adjust</label>
                            <div className="flex items-center gap-2">
                                <FormInput 
                                    id="adjustmentPercentage" 
                                    name="adjustmentPercentage" 
                                    type="number" 
                                    value={adjustmentPercentage} 
                                    onChange={(e) => setAdjustmentPercentage(e.target.value)} 
                                    placeholder="%"
                                    className="input-box w-24"
                                />
                                <button onClick={() => handleAdjustment('add')} className="save-btn-modern text-lg px-3 py-1">+</button>
                                <button onClick={() => handleAdjustment('subtract')} className="delete-btn-modern text-lg px-3 py-1">-</button>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <label htmlFor="adjustmentAmount" className="input-label">Amount Adjust</label>
                            <div className="flex items-center gap-2">
                                <FormInput 
                                    id="adjustmentAmount" 
                                    name="adjustmentAmount" 
                                    type="number" 
                                    value={adjustmentAmount} 
                                    onChange={(e) => setAdjustmentAmount(e.target.value)} 
                                    placeholder="Amt"
                                    className="input-box w-24"
                                />
                                <button onClick={() => handleAmountAdjustment('add')} className="save-btn-modern text-lg px-3 py-1">+</button>
                                <button onClick={() => handleAmountAdjustment('subtract')} className="delete-btn-modern text-lg px-3 py-1">-</button>
                            </div>
                        </div>
                    </div>

                    {/* Fit Detail Table */}
                    <div className="overflow-x-auto mb-4">
                        <h4 className="text-lg font-semibold mb-3 text-gray-700">Fit Details</h4>
                        <table className="result-table-modern compact-table">
                            <thead>
                                <tr>
                                    <th>Details</th>
                                    {result.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Best Fit Sheet</td>
                                    {result.map((r, i) => <td key={i}>{r.bestFitDetails.sheet ? `${r.bestFitDetails.sheet.width}" x ${r.bestFitDetails.sheet.height}"` : '-'}</td>)}
                                </tr>
                                <tr>
                                    <td>UPS</td>
                                    {result.map((r, i) => <td key={i}>{r.bestFitDetails.ups || '-'}</td>)}
                                </tr>
                                {result.some(r => r.checkA) && <tr><td>Check A</td>{result.map((r, i) => <td key={i}>{r.checkA ? 'Yes' : '-'}</td>)}</tr>}
                                {result.some(r => r.checkB) && <tr><td>Check B</td>{result.map((r, i) => <td key={i}>{r.checkB ? 'Yes' : '-'}</td>)}</tr>}
                                {result.some(r => r.checkC) && <tr><td>Check C</td>{result.map((r, i) => <td key={i}>{r.checkC ? 'Yes' : '-'}</td>)}</tr>}
                                {result.some(r => r.reelcut) && <tr><td>Reel Cut</td>{result.map((r, i) => <td key={i}>{r.reelcut ? 'Yes' : '-'}</td>)}</tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Cost Breakdown Table */}
                    <div className="overflow-x-auto mb-4">
                        <h4 className="text-lg font-semibold mb-3 text-gray-700">Cost Breakdown</h4>
                        <table className="result-table-modern compact-table">
                            <thead>
                                <tr>
                                    <th>Option</th>
                                    <th>Details</th>
                                    <th>No of Sheets</th>
                                    <th>Paper Cost</th>
                                    <th>Printing Cost</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.map((r, i) => (
                                    <React.Fragment key={i}>
                                        {r.bestFitDetails.runDetails.map((run, j) => (
                                            <tr key={j} style={{ backgroundColor: `hsl(${i * 60}, 70%, 95%)` }}>
                                                <td>{j === 0 ? i + 1 : ''}</td>
                                                <td>{run.method}</td>
                                                <td>{run.sheets}</td>
                                                <td>₹{run.paperCost.toFixed(2)}</td>
                                                <td>₹{run.printingCost.toFixed(2)}</td>
                                                <td>₹{(run.paperCost + run.printingCost).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {r.postPressCosts.lamCost > 0 && (
                                            <tr style={{ backgroundColor: `hsl(${i * 60}, 70%, 95%)` }}>
                                                <td colSpan="5" className="text-right">Lamination Cost</td>
                                                <td>₹{r.postPressCosts.lamCost.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {r.postPressCosts.additionalProcessCost > 0 && (
                                            <tr style={{ backgroundColor: `hsl(${i * 60}, 70%, 95%)` }}>
                                                <td colSpan="5" className="text-right">Additional Process 1 Cost</td>
                                                <td>₹{r.postPressCosts.additionalProcessCost.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {r.postPressCosts.additionalProcessCost2 > 0 && (
                                            <tr style={{ backgroundColor: `hsl(${i * 60}, 70%, 95%)` }}>
                                                <td colSpan="5" className="text-right">Additional Process 2 Cost</td>
                                                <td>₹{r.postPressCosts.additionalProcessCost2.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {r.postPressCosts.dieCost > 0 && (
                                            <tr style={{ backgroundColor: `hsl(${i * 60}, 70%, 95%)` }}>
                                                <td colSpan="5" className="text-right">Die Cost</td>
                                                <td>₹{r.postPressCosts.dieCost.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {r.postPressCosts.punchCost > 0 && (
                                            <tr style={{ backgroundColor: `hsl(${i * 60}, 70%, 95%)` }}>
                                                <td colSpan="5" className="text-right">Punching Cost</td>
                                                <td>₹{r.postPressCosts.punchCost.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {r.postPressCosts.fabricationCost > 0 && (
                                            <tr style={{ backgroundColor: `hsl(${i * 60}, 70%, 95%)` }}>
                                                <td colSpan="5" className="text-right">Fabrication Cost</td>
                                                <td>₹{r.postPressCosts.fabricationCost.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {r.postPressCosts.fabricationCostN > 0 && (
                                            <tr style={{ backgroundColor: `hsl(${i * 60}, 70%, 95%)` }}>
                                                <td colSpan="5" className="text-right">Fabrication 2 Cost</td>
                                                <td>₹{r.postPressCosts.fabricationCostN.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        <tr style={{ backgroundColor: `hsl(${i * 60}, 70%, 85%)` }}>
                                            <td colSpan="3" className="font-bold text-right">Option {i + 1} Total</td>
                                            <td className="font-bold">₹{r.baseCost.totalPaperCost.toFixed(2)}</td>
                                            <td className="font-bold">₹{r.baseCost.totalPrintingCost.toFixed(2)}</td>
                                            <td className="font-bold">₹{r.totalCost.toFixed(2)}</td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    

                </div>
            )}
        </div>
    );
};

export default CutToSheet;
