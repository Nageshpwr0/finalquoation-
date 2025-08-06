import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../design-system.css';

// --- Helper Functions & Constants ---
const paperOptions = [
    { value: "A4", label: "A4", weight: 450, ups: 8, imp: 400, makrdy: 1900 },
    { value: "A5", label: "A5", weight: 450, ups: 16, imp: 400, makrdy: 1900 },
    { value: "A6", label: "A6", weight: 450, ups: 32, imp: 400, makrdy: 1900 },
    { value: "Letter", label: "Letter", weight: 414, ups: 8, imp: 400, makrdy: 1900 },
    { value: "Half-Letter", label: "Half-Letter", weight: 414, ups: 16, imp: 400, makrdy: 1900 },
    { value: "7.1x9.5", label: "7.1x9.5", weight: 600, ups: 16, imp: 500, makrdy: 2700, fullSheet: true },
    { value: "7.1x4.75", label: "7.1x4.75", weight: 600, ups: 32, imp: 500, makrdy: 2700, fullSheet: true },
    { value: "9.5x13.5", label: "9.5x13.5", weight: 600, ups: 8, imp: 500, makrdy: 2700, fullSheet: true },
    { value: "9x9", label: "9x9", weight: 600, ups: 12, imp: 500, makrdy: 2700, fullSheet: true },
    { value: "8x8", label: "8x8", weight: 450, ups: 12, imp: 400, makrdy: 1900 },
    { value: "12x12", label: "12x12", weight: 400, ups: 4, imp: 400, makrdy: 1900, fullSheet: true },
    { value: "11x11", label: "11x11", weight: 276, ups: 4, imp: 400, makrdy: 1900, fullSheet: true },
    { value: "20x29.5", label: "20x29.5", weight: 600, ups: 4, imp: 500, makrdy: 2700, fullSheet: true },
];

const sizesCompatibleWith20x28 = ['9.5x13.5', '9x9'];

const getWastage = (qty) => {
    if (qty <= 1500) return 100; if (qty <= 2500) return 150; if (qty <= 5000) return 200;
    if (qty <= 9000) return 250; if (qty <= 15000) return 350; return 500;
};
const getCoverWastage = (qty) => {
    const halfQty = qty / 2;
    if (halfQty <= 2100) return 100; if (halfQty <= 4000) return 150; if (halfQty <= 5000) return 200;
    if (halfQty <= 9000) return 250; if (halfQty <= 15000) return 350; return 500;
};
const adjustFraction = (val) => {
    const fractional = val % 1;
    if (Math.abs(fractional - 0.25) < 0.01) return Math.floor(val) + 0.5;
    if (Math.abs(fractional - 0.75) < 0.01) return Math.ceil(val);
    if (Math.abs(fractional - 0.333) < 0.01) return Math.floor(val) + 0.5;
    if (Math.abs(fractional - 0.666) < 0.01) return Math.ceil(val);
    return val;
};
const formatCurrency = (value) => `₹ ${Number(value || 0).toFixed(2)}`;
const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
};

const getPrintingDisplayName = (printingType) => {
    const printingMap = {
        'multi': 'Multi-Color',
        'single': 'Single Color',
        '2+2': '2+2 Color',
        'none': 'None'
    };
    return printingMap[printingType] || capitalizeFirstLetter(printingType);
};

const getFitSheetSize = (paperSize, printingType) => {
    const isColorPrinting = printingType === 'multi';
    const isSingleOr2Plus2 = printingType === 'single' || printingType === '2+2';
    
    switch(paperSize) {
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
            return '13x16';
        default:
            return '20x30';
    }
};

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

export default function Booklet({ formData, onSaved, getNextSerial, customers, paperTypes = [], onAddNewCustomer, apiUrl, onNavigate }) {
    const [inputs, setInputs] = useState({
        qty1: '', paperType: '', rate: '', paperSize: '', pages: '', gsm: '',
        printingType: 'multi', lamination: 'none', bindingType: 'center-pinning', coverGsm: '',
        coverPrintingColor: 'multi', coverLamination: 'matt', uvType: 'none', foilingType: 'none',
        dripUpType: 'none',
        checkA: false, checkB: false, checkC: false,
        repetJob: false,
        customerName: '',
        quotationNumber: '',
    });
    const [results, setResults] = useState([]);
    const [error, setError] = useState('');
    const [showPaperModal, setShowPaperModal] = useState(false);
    const [showAdditional, setShowAdditional] = useState(false);
    const [serial, setSerial] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState('');
    const [rateLabel, setRateLabel] = useState('Rate per pc');
    const [adjustmentPercentage, setAdjustmentPercentage] = useState(0);
    const [adjustmentAmount, setAdjustmentAmount] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const [availableQuotations, setAvailableQuotations] = useState([]);
    const [selectedQuotation, setSelectedQuotation] = useState(null);
    const [showFitDetails, setShowFitDetails] = useState(false);
    const [processDetails, setProcessDetails] = useState([]);

    const isHardbound = useMemo(() => inputs.bindingType === 'hardbound-gally-section', [inputs.bindingType]);

    useEffect(() => {
        if (formData) {
            setInputs(formData.inputs || formData);
            setResults(formData.results || []);
            setSerial(formData.serial || null);
        }
    }, [formData]);
    
    // Fetch available quotations for dropdown
    useEffect(() => {
        fetch(`${apiUrl}/api/quotations`)
            .then(res => res.json())
            .then(data => {
                if (data && data.data) {
                    const bookletQuotations = data.data.filter(q => q.productType === 'Booklet');
                    setAvailableQuotations(bookletQuotations);
                }
            })
            .catch(error => {
                console.error('Error fetching quotations:', error);
            });
    }, [apiUrl]);
    
    useEffect(() => {
        if (isHardbound) {
            setInputs(prev => ({ ...prev, coverGsm: '250', coverPrintingColor: 'none', coverLamination: 'none' }));
        }
    }, [isHardbound]);

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

    const handleInputChange = (e) => {
        const { id, value, type, checked, name } = e.target;
        const key = name || id;
        setInputs(prev => ({
            ...prev,
            [key]: type === 'checkbox' ? checked : value
        }));
        setRateLabel('Rate per pc');
        setHasUnsavedChanges(true);
    };

    const handleAbcCheck = (id) => {
        setInputs((prev) => {
            const wasA = prev.checkA;
            const wasB = prev.checkB;
            const wasC = prev.checkC;

            return {
                ...prev,
                checkA: id === 'A' ? !wasA : false,
                checkB: id === 'B' ? !wasB : false,
                checkC: id === 'C' ? !wasC : false,
            };
        });
    };

    const handleAdjustment = (operation) => {
        const percentage = parseFloat(adjustmentPercentage);
        if (isNaN(percentage) || percentage === 0) return;

        const multiplier = operation === 'add' ? (1 + percentage / 100) : (1 - percentage / 100);

        const newResults = results.map(r => {
            const newAmount = r.finalAmount * multiplier;
            return {
                ...r,
                finalAmount: newAmount,
                bookletRate: newAmount / r.qty,
            };
        });
        setResults(newResults);
        setRateLabel('Rate edited');
    };

    const handleAmountAdjustment = (direction) => {
        const amount = parseFloat(adjustmentAmount) || 0;
        if (amount === 0) return;

        const adjustment = direction === 'add' ? amount : -amount;

        setResults(prevResult => prevResult.map(r => {
            const newTotalCost = r.finalAmount + adjustment;
            const newFinalRate = newTotalCost / r.qty;
            return { ...r, finalAmount: newTotalCost, bookletRate: newFinalRate };
        }));
    };

     const calculateSingleQuantity = (currentInputs, paperData) => {
        const { qty, pages, gsm, rate, size, printing, pressType, repetJob } = currentInputs;
        const wastage = getWastage(qty);
        const netSheets = (qty * pages) / paperData.ups;
        const totalSheets = printing.startsWith("common-ruled") 
            ? netSheets + wastage 
            : ((qty + wastage) * pages) / paperData.ups;
        const paperCost = (paperData.weight * gsm) / 3100 * (rate / 500) * totalSheets;
        let pageUps = adjustFraction(pages / paperData.ups);
        let printingCost = 0;
        const isSmallSize = ["A4", "A5", "A6", "Letter", "Half-Letter"].includes(size);
        const isSpecialSize = ["7.1x9.5", "7.1x4.75"].includes(size);
        if (pressType === 'pressA') {
            if (printing === "multi") {
                const defaultCost = (qty < 1100 ? Math.max((paperData.makrdy - 150) * pageUps * 2, 1750) : (Math.ceil(qty / 1000) * paperData.imp + (paperData.makrdy - (paperData.imp + 150))) * pageUps * 2);
                printingCost = repetJob ? defaultCost - (700 * pageUps * 2) : defaultCost;
            } else if (printing === "common-ruled-4+4") {
                 printingCost = Math.ceil(netSheets / 1000) * 2 * (isSpecialSize ? 450 : 380) + (isSpecialSize ? 2000 : 1400);
            } else {
                if (printing === "single") {
                    if (!(isSmallSize || isSpecialSize)) { setError("Single color is only allowed for select paper sizes."); return null; }
                    const defaultCost = (qty < 1000 ? (600 * pageUps) * 2 : (isSpecialSize ? (Math.ceil(qty / 1000) * 150 + 400) * pageUps * 4 : (Math.ceil(qty / 1000) * 150 + 450) * pageUps * 2));
                    printingCost = repetJob ? defaultCost - 150 : defaultCost;
                } else if (printing === "2+2") {
                    if (!(isSmallSize || isSpecialSize)) { setError("2+2 color is only allowed for select paper sizes."); return null; }
                    const defaultCost = (qty < 1000 ? (800 * pageUps) * 2 : (isSpecialSize ? (Math.ceil(qty / 1000) * 200 + 600) * pageUps * 4 : (Math.ceil(qty / 1000) * 200 + 600) * pageUps * 2));
                    printingCost = repetJob ? defaultCost - 200 : defaultCost;
                }
            }
        } else if (pressType === 'pressB') {
             if (printing === "multi") {
                const defaultCost = (qty < 1100 ? Math.max((paperData.makrdy - 300) * pageUps * 2, 1600) : (Math.ceil(qty / 1000) * paperData.imp + (paperData.makrdy - (paperData.imp + 300))) * pageUps * 2);
                printingCost = repetJob ? defaultCost - (700 * pageUps * 2) : defaultCost;
            } else {
                if (printing === "single" || printing === "2+2") { setError("This printing type is not configured for Press B."); return null; }
            }
        } else if (pressType === 'pressC') {
            if (printing === "multi") {
                const defaultCost = (qty < 1100 ? Math.max((paperData.makrdy + 200) * pageUps * 2, 2100) : (Math.ceil(qty / 1000) * paperData.imp + (paperData.makrdy - (paperData.imp - 200))) * pageUps * 2);
                printingCost = repetJob ? defaultCost - (700 * pageUps * 2) : defaultCost;
            } else {
                 if (printing === "single" || printing === "2+2") { setError("This printing type is not configured for Press C."); return null; }
            }
        } else { // pressD
            if (printing === "multi") {
                const defaultCost = (qty < 1100 ? Math.max((paperData.makrdy * pageUps) * 2, 1900) : (Math.ceil(qty / 1000) * paperData.imp + (paperData.makrdy - paperData.imp)) * pageUps * 2);
                printingCost = repetJob ? defaultCost - (700 * pageUps * 2) : defaultCost;
            } else if (printing === "single") {
                if (!(isSmallSize || isSpecialSize)) { setError("Single color is only allowed for select paper sizes."); return null; }
                const defaultCost = (qty < 1000 ? (600 * pageUps) * 2 : (isSpecialSize ? (Math.ceil(qty / 1000) * 150 + 400) * pageUps * 4 : (Math.ceil(qty / 1000) * 150 + 450) * pageUps * 2));
                printingCost = repetJob ? defaultCost - (150 * pageUps * 2) : defaultCost;
            } else if (printing === "2+2") {
                if (!(isSmallSize || isSpecialSize)) { setError("2+2 color is only allowed for select paper sizes."); return null; }
                const defaultCost = (qty < 1000 ? 800 * pageUps * 2 : (isSpecialSize ? (Math.ceil(qty / 1000) * 200 + 600) * pageUps * 4 : (Math.ceil(qty / 1000) * 200 + 600) * pageUps * 2));
                printingCost = repetJob ? defaultCost - (200 * pageUps * 2) : defaultCost;
            } else if (printing.startsWith("common-ruled")) {
                 if (!(isSmallSize || isSpecialSize)) { setError(`Common ruled printing is not allowed for ${size}.`); return null; }
                 switch(printing) {
                    case "common-ruled-4+4": printingCost = Math.ceil(netSheets / 1000) * 2 * (isSpecialSize ? 500 : 400) + (isSpecialSize ? 2200 : 1600); break;
                    case "common-ruled-2+2": printingCost = Math.ceil(netSheets * 2 / 1000) * (isSpecialSize ? 2 : 1) * 200 + 600; break;
                    case "common-ruled-1+1": printingCost = Math.ceil(netSheets * 2 / 1000) * (isSpecialSize ? 2 : 1) * 150 + 450; break;
                    case "common-ruled-4+0": printingCost = Math.ceil(netSheets / 1000) * (isSpecialSize ? 500 : 400) + (isSpecialSize ? 2200 : 1600); break;
                    case "common-ruled-2+0": printingCost = Math.ceil(netSheets / 1000) * (isSpecialSize ? 2 : 1) * 200 + 600; break;
                    case "common-ruled-1+0": printingCost = Math.ceil(netSheets / 1000) * (isSpecialSize ? 2 : 1) * 150 + 450; break;
                    default: break;
                 }
            }
        }
        let laminationCost = 0;
        if (currentInputs.lamination !== "none") {
            const laminationRate = { "matt-all": 0.48, "gloss-all": 0.45, "varnish-all": 0.25 };
            laminationCost = paperData.weight * laminationRate[currentInputs.lamination] * (qty + wastage) / 100 * (pageUps * 2 + 0.5);
        }
        let coverPaperCost = 0, coverPrintingCost = 0, coverLaminationCost = 0;
        if (currentInputs.bindingType !== 'hardbound-gally-section' && !isNaN(currentInputs.coverGsm) && currentInputs.coverGsm > 0) {
            const coverWastage = getCoverWastage(qty);
            coverPaperCost = (paperData.weight * currentInputs.coverGsm) / 3100 * (rate / 500) * ((qty * 4 / paperData.ups) + coverWastage);
            const coverUpsDivisor = paperData.ups / 8;
            if (size === '12x12' || size === '11x11') {
                const defaultCost = (Math.ceil(qty / 1000) * 400 + 1600) * 2;
                coverPrintingCost = repetJob ? defaultCost - 700 : defaultCost;
            } else {
                let defaultCost = 0;
                if (currentInputs.coverPrintingColor === "multi") {
                    defaultCost = qty < 1000 ? paperData.makrdy - 0 : (Math.ceil(qty / coverUpsDivisor / 1000) * paperData.imp + (paperData.makrdy - paperData.imp));
                } else if (currentInputs.coverPrintingColor === "single") {
                    defaultCost = (Math.ceil(qty / coverUpsDivisor / 1000) * 150 + 450);
                } else if (currentInputs.coverPrintingColor === "2+2") {
                    defaultCost = (Math.ceil(qty / coverUpsDivisor / 1000) * 200 + 600);
                }
                coverPrintingCost = repetJob ? defaultCost - 700 : defaultCost;
            }
            if (currentInputs.coverLamination !== "none") {
                const coverLaminationRates = { "matt": 0.45, "thermal": 0.85, "velvet": 3, "gloss": 0.42, "varnish": 0.25 };
                coverLaminationCost = ((qty / (paperData.ups / 4)) + coverWastage) * paperData.weight * coverLaminationRates[currentInputs.coverLamination] / 100;
            }
        }
        let bindingCost = 0;
        switch (currentInputs.bindingType) {
            case "center-pinning":
                let tempBindingCost = 0;
                if (qty <= 1200) {
                    if (pages < 30) tempBindingCost = qty * pages * 0.05; else if (pages <= 45) tempBindingCost = qty * pages * 0.05;
                    else if (pages <= 60) tempBindingCost = qty * pages * 0.04; else if (pages <= 72) tempBindingCost = qty * pages * 0.03;
                    else tempBindingCost = qty * pages * 0.02;
                } else if (qty <= 3000) {
                    if (pages < 30) tempBindingCost = qty * pages * 0.04; else if (pages <= 72) tempBindingCost = qty * pages * 0.03;
                    else tempBindingCost = qty * pages * 0.02;
                } else {
                    if (pages <= 10) tempBindingCost = Math.max(qty * pages * 0.065, qty * 0.75); else if (pages <= 16) tempBindingCost = Math.max(qty * pages * 0.04, qty * 0.75);
                    else if (pages <= 30) tempBindingCost = Math.max(qty * pages * 0.025, qty * 0.75); else tempBindingCost = Math.max(qty * pages * 0.02, qty * 0.65);
                }
                if (qty < 3000 && pages < 20) { tempBindingCost = Math.max(tempBindingCost, qty * 1); }
                bindingCost = Math.max(tempBindingCost, 1200);
                break;
            case "section-perfect":
                let ratesection = 0.08;
                if (["9.5x13.5", "11x11", "12x12", "9x9"].includes(size)) { ratesection = 0.08; } 
                else if (qty > 1000 && qty <= 3100) { if (pages > 100) ratesection = 0.05; else if (pages >= 60) ratesection = 0.06; else if (pages >= 35) ratesection = 0.07; } 
                else if (qty > 3100 && qty <= 6000) { if (pages > 60) ratesection = 0.05; else if (pages >= 36) ratesection = 0.06; else ratesection = 0.07; } 
                else if (qty > 6000) { ratesection = pages > 60 ? 0.05 : 0.06; } 
                else { if (pages > 150) ratesection = 0.05; else if (pages >= 100) ratesection = 0.06; else if (pages >= 60) ratesection = 0.07; }
                bindingCost = Math.max(qty * ratesection * (pages + 4), 4000);
                break;
            case "perfect-binding": bindingCost = Math.max(qty * (qty > 2500 ? 0.035 : 0.04) * (pages + 4), 3000); break;
            case "top-perfect-pad":
                if (["A5", "Half-Letter", "7.1x4.75"].includes(size)) bindingCost = Math.max(qty * 0.8, 2500);
                else if (["A4", "Letter"].includes(size)) bindingCost = Math.max(qty * 1.50, 3000);
                else if (size === "7.1x9.5") bindingCost = Math.max(qty * 1.40, 3000);
                else { setError("Top Perfect Pad binding is not available for the selected paper size."); return null; }
                break;
            case "wiro":
                const spin = (pages * gsm) / 1700 + 4;
                let ratePerLoop = 0;
                if (spin < 7) ratePerLoop = 0.10; else if (spin < 8) ratePerLoop = 0.12; else if (spin < 10) ratePerLoop = 0.18; else if (spin < 13) ratePerLoop = 0.24; else if (spin < 14.5) ratePerLoop = 0.30; else if (spin < 17) ratePerLoop = 0.35; else if (spin < 22.1) ratePerLoop = 0.55; else if (spin < 31) ratePerLoop = 1.6;
                else { setError("WIRO binding not available for this combination of pages and GSM."); return null; }
                const loopMap = {"A4": 34, "Letter": 34, "A5": 21, "Half-Letter": 21, "A6": 17, "7.1x9.5": 30, "7.1x4.75": 21, "9.5x13.5": 40, "9x9": 27, "8x8": 24, "12x12": 36, "11x11": 33};
                if (!loopMap[size]) { setError("WIRO binding is not available for the selected paper size."); return null; }
                const loops = loopMap[size];
                const wiroRate = ((ratePerLoop * loops) + 4) * qty + (qty * pages / paperData.ups / (pages / 2) * 3);
                bindingCost = Math.max(wiroRate, 3000);
                break;
            case "loop-pinning": bindingCost = Math.max(qty * (pages <= 100 ? 2 : 1.5), 2500); break;
            case "hardbound-gally-section":
                let hardboundBase = 0;
                if (["A5", "Half-Letter"].includes(size)) hardboundBase = (2 * qty + wastage) + (Math.ceil(qty / 1000) / 2 * 400 + 1600) + (4 * (qty + wastage)) + (15.5 * qty) + (2 * qty);
                else if (["A4", "Letter"].includes(size)) hardboundBase = (4 * qty + wastage) + (Math.ceil(qty / 1000) * 400 + 1600) + (6 * (qty + wastage)) + (21 * qty) + (4 * qty);
                else if (size === "7.1x9.5") hardboundBase = (3 * qty + wastage) + (Math.ceil(qty / 1000) * 400 + 1600) + (5 * (qty + wastage)) + (17 * qty) + (3 * qty);
                else if (size === "9.5x13.5") hardboundBase = (4 * qty + wastage) + (Math.ceil(qty / 1000) * 400 + 1600) + (8 * (qty + wastage)) + (25 * qty) + (5 * qty);
                else if (["12x12", "11x11"].includes(size)) hardboundBase = (6 * qty + wastage) + (Math.ceil(qty / 1000) * 400 + 1600) + (8 * (qty + wastage)) + (18 * qty) + (4 * qty);
                else if (["8x8", "9x9"].includes(size)) hardboundBase = (5 * qty + wastage) + (Math.ceil(qty / 1000) * 400 + 1600) + (6 * (qty + wastage)) + (17 * qty) + (3 * qty);
                else { setError("Please select a supported paper size for Hardbound Gally Section binding."); return null; }
                bindingCost = hardboundBase + (qty * pages * 0.08);
                break;
            default: break;
        }
        if (currentInputs.paperType === "ArtCard") { bindingCost += (pages / 4) * qty * 0.2; }
        let uvCost = 0, foilingCost = 0, dripupCost = 0;
        const coverSheetQty = qty * 4 / paperData.ups * 2;
        if (currentInputs.uvType === "spot-uv-cover") uvCost = Math.max(Math.ceil(coverSheetQty / 1000) * 2000 + 200, 2000);
        else if (currentInputs.uvType === "raised-uv-cover") uvCost = Math.max(Math.ceil(coverSheetQty / 1000) * 2500, 2700);
        else if (currentInputs.uvType === "spot-uv-all-pages") uvCost = (Math.ceil(coverSheetQty / 1000) * 1800) * (pageUps * 2);
        if (currentInputs.foilingType === "stamp-foil-cover") foilingCost = Math.max(Math.ceil(coverSheetQty / 1000) * 2200 + 1500, 3500);
        else if (currentInputs.foilingType === "magic-gold-foil-cover") foilingCost = Math.max(Math.ceil(coverSheetQty / 1000) * 8000, 8000);
        if (currentInputs.dripUpType === "drip-up-cover") dripupCost = Math.max(Math.ceil(qty / 1000) * 5000, 6000);
        else if (currentInputs.dripUpType === "drip-up-all-pages") {
            const baseCost = (paperData.weight * 0.75 * (qty + wastage) / 100) + 1000;
            dripupCost = Math.max(baseCost * (pageUps * 2) + bindingCost, 6000);
        }
        const finalAmount = paperCost + printingCost + laminationCost + bindingCost + coverPaperCost + coverPrintingCost + coverLaminationCost + uvCost + foilingCost + dripupCost;
        const bookletRate = finalAmount / qty;
        return { paperCost, coverPaperCost, printingCost, coverPrintingCost, laminationCost, coverLaminationCost, bindingCost, uvCost, foilingCost, dripupCost, finalAmount, bookletRate };
    };

    const proceedWithCalculation = (fullSheetWeight = null) => {
        setShowPaperModal(false);
        const quantities = [inputs.qty1].map(q => parseInt(q)).filter(q => !isNaN(q) && q > 0);
        if (quantities.length === 0) { setError("Please enter at least one valid Quantity."); return; }
        if (!inputs.customerName) {
            setError("Please select a customer.");
            return;
        }
        
        let pressType = 'pressD';
        if (inputs.checkA) pressType = 'pressA';
        else if (inputs.checkB) pressType = 'pressB';
        else if (inputs.checkC) pressType = 'pressC';

        const parsedInputs = {
            pages: parseInt(inputs.pages), gsm: parseFloat(inputs.gsm), rate: parseFloat(inputs.rate),
            size: inputs.paperSize, printing: inputs.printingType, lamination: inputs.lamination,
            bindingType: inputs.bindingType, coverGsm: parseFloat(inputs.coverGsm),
            coverPrintingColor: inputs.coverPrintingColor, coverLamination: inputs.coverLamination,
            uvType: inputs.uvType, foilingType: inputs.foilingType, dripUpType: inputs.dripUpType,
            paperType: inputs.paperType, 
            pressType: pressType,
            repetJob: inputs.repetJob,
        };
        if (isNaN(parsedInputs.pages) || parsedInputs.pages <= 0) { setError("Please enter valid Pages."); return; }
        if (parsedInputs.pages % 4 !== 0) { setError("Pages must be divisible by 4."); return; }
        if (isNaN(parsedInputs.rate) || parsedInputs.rate <= 0) { setError("Please enter a valid Paper Rate."); return; }
        if (isNaN(parsedInputs.gsm) || parsedInputs.gsm <= 0) { setError("Please enter a valid GSM."); return; }
        
        // GSM validation
        const selectedPaperType = paperTypes.find(p => p.paperTypeName === inputs.paperType);
        if (selectedPaperType && selectedPaperType.minGsm && selectedPaperType.maxGsm) {
            if (parsedInputs.gsm < selectedPaperType.minGsm || parsedInputs.gsm > selectedPaperType.maxGsm) {
                setError(`GSM must be between ${selectedPaperType.minGsm} and ${selectedPaperType.maxGsm} for ${selectedPaperType.paperTypeName}`);
                return;
            }
        }
        if (!parsedInputs.size) { setError("Please select a Paper Size."); return; }
        const selectedPaper = paperOptions.find(p => p.value === parsedInputs.size);
        if (!selectedPaper) { setError("Could not retrieve paper size data."); return; }
        const paperData = { ...selectedPaper, weight: fullSheetWeight || selectedPaper.weight };
        const allResults = quantities.map(qty => {
            const currentRunInputs = { ...parsedInputs, qty };
            const result = calculateSingleQuantity(currentRunInputs, paperData);
            return result ? { ...result, qty: qty, finalAmount: result.finalAmount, bookletRate: result.bookletRate, inputs: currentRunInputs } : null;
        }).filter(Boolean);

        if (allResults.length > 0 && allResults.length === quantities.length) {
            setResults(prevResults => {
                setHasUnsavedChanges(true);
                return [...prevResults, ...allResults];
            });
            if (!serial) setSerial(getNextSerial());
            setRateLabel('Rate per pc');
        }
    };

    const handleCalculate = () => {
        const selectedOption = paperOptions.find(p => p.value === inputs.paperSize);
        if (selectedOption?.fullSheet && sizesCompatibleWith20x28.includes(selectedOption.value)) {
            setShowPaperModal(true);
        } else {
            proceedWithCalculation();
        }
    };

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
          productType: 'Booklet',
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

    const handleDeleteResult = (index) => {
        const newResults = results.filter((_, i) => i !== index);
        if (newResults.length === 0) {
            setHasUnsavedChanges(false);
        }
        setResults(newResults);
    };

    const handleQuotationSelect = (e) => {
        const quotationSerial = e.target.value;
        setInputs(prev => ({
            ...prev,
            quotationNumber: quotationSerial
        }));

        if (quotationSerial) {
            const quotation = availableQuotations.find(q => q.serial.toString() === quotationSerial);
            if (quotation) {
                setSelectedQuotation(quotation);
                const inputs = quotation.inputs || {};
                const results = quotation.results || [];
                
                // Auto-fill form fields from selected quotation
                setInputs(prev => ({
                    ...prev,
                    customerName: quotation.customerName || '',
                    qty1: inputs.qty1 || '',
                    paperType: inputs.paperType || '',
                    rate: inputs.rate || '',
                    paperSize: inputs.paperSize || '',
                    pages: inputs.pages || '',
                    gsm: inputs.gsm || '',
                    printingType: inputs.printingType || 'multi',
                    lamination: inputs.lamination || 'none',
                    bindingType: inputs.bindingType || 'center-pinning',
                    coverGsm: inputs.coverGsm || '',
                    coverPrintingColor: inputs.coverPrintingColor || 'multi',
                    coverLamination: inputs.coverLamination || 'matt',
                    uvType: inputs.uvType || 'none',
                    foilingType: inputs.foilingType || 'none',
                    dripUpType: inputs.dripUpType || 'none',
                    checkA: inputs.checkA || false,
                    checkB: inputs.checkB || false,
                    checkC: inputs.checkC || false,
                    repetJob: inputs.repetJob || false
                }));
                
                // Auto-populate results if available
                if (results && results.length > 0) {
                    setResults(results);
                    setHasUnsavedChanges(true);
                }
                
                // Generate fit details and process details
                generateFitAndProcessDetails(quotation);
                setShowFitDetails(true);
            }
        } else {
            setSelectedQuotation(null);
            setShowFitDetails(false);
            setProcessDetails([]);
        }
    };

    const generateFitAndProcessDetails = (quotation) => {
        const inputs = quotation.inputs || {};
        const results = quotation.results || [];
        
        if (results.length === 0) return;
        
        const processDetailsArray = results.map((result, index) => {
            const selectedPaper = paperOptions.find(p => p.value === result.inputs?.size || inputs.paperSize);
            const ups = selectedPaper?.ups || 1;
            const pages = parseInt(result.inputs?.pages || inputs.pages || 0);
            const qty = parseInt(result.inputs?.qty || inputs.qty1 || 0);
            const printingType = result.inputs?.printing || inputs.printingType || 'multi';
            
            // Calculate forms
            const innerForms = pages / ups;
            const wholeNumber = Math.floor(innerForms);
            const fractional = innerForms - wholeNumber;
            
            let forms = 'frontback';
            let sideCount = 2;
            
            // Determine form type based on printing type
            if (printingType.includes('single') || printingType.includes('1+0') || printingType.includes('2+0') || printingType.includes('4+0')) {
                forms = 'oneside';
                sideCount = 1;
            } else if (printingType.includes('1+1') || printingType.includes('2+2') || printingType.includes('4+4') || printingType === 'multi') {
                forms = 'frontback';
                sideCount = 2;
            }
            
            // Calculate total sheets needed
            const wastage = getWastage(qty);
            const totalSheets = Math.ceil((qty + wastage) * pages / ups);
            
            return {
                optionNumber: index + 1,
                forms: forms,
                sideCount: sideCount,
                qty: totalSheets,
                extraSheets: wastage,
                paperSize: result.inputs?.size || inputs.paperSize || '',
                fitSheetSize: getFitSheetSize(result.inputs?.size || inputs.paperSize || '', printingType),
                ups: ups,
                lamination: result.inputs?.lamination || inputs.lamination || 'none',
                binding: result.inputs?.bindingType || inputs.bindingType || 'center-pinning',
                printingType: printingType,
                innerForms: innerForms,
                wholeNumber: wholeNumber,
                fractional: fractional,
                pages: pages,
                originalQty: qty,
                uvType: result.inputs?.uvType || inputs.uvType || 'none',
                foilingType: result.inputs?.foilingType || inputs.foilingType || 'none',
                dripUpType: result.inputs?.dripUpType || inputs.dripUpType || 'none'
            };
        });
        
        setProcessDetails(processDetailsArray);
    };

    return (
        <div className={`cuttosheet-flex-container ${results.length > 0 ? 'results-visible' : ''}`}>
            <div className="cuttosheet-box cuttosheet-form-box">
                <h1 className="form-title-pink">Booklet Quotation</h1>
                <form className="cut-to-sheet-form" onSubmit={e => e.preventDefault()}>
                    <div className="form-grid-modern">
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ flexGrow: 1 }}>
                            <label htmlFor="customerName" className="input-label">Customer Name</label>
                            <select id="customerName" name="customerName" className="input-box" value={inputs.customerName} onChange={handleInputChange}>
                              <option value="">-- Select Customer --</option>
                              {customers.sort((a, b) => (a.customerName || '').localeCompare(b.customerName || '')).map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
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
                            <label htmlFor="qty1" className="input-label">Quantity</label>
                            <input type="number" id="qty1" name="qty1" className="input-box" value={inputs.qty1} onChange={handleInputChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="paperType" className="input-label">Paper Type <span style={{ color: 'red' }}>*</span></label>
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
                            }} required>
                                <option value="">-- Select --</option>
                                {paperTypes.map(p => <option key={p.id} value={p.paperTypeName}>{p.paperTypeName}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="rate" className="input-label">Paper Rate (per kg) <span style={{ color: 'red' }}>*</span></label>
                            <input type="number" id="rate" name="rate" className="input-box" value={inputs.rate} onChange={handleInputChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="paperSize" className="input-label">Paper Size <span style={{ color: 'red' }}>*</span></label>
                            <select id="paperSize" name="paperSize" className="input-box" value={inputs.paperSize} onChange={handleInputChange} required>
                                <option value="">-- Select --</option>
                                {paperOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="pages" className="input-label">Number of Pages <span style={{ color: 'red' }}>*</span></label>
                            <input type="number" id="pages" name="pages" className="input-box" value={inputs.pages} onChange={handleInputChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="gsm" className="input-label">Inner GSM <span style={{ color: 'red' }}>*</span></label>
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
                            }} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="printingType" className="input-label">Printing Type <span style={{ color: 'red' }}>*</span></label>
                            <select id="printingType" name="printingType" className="input-box" value={inputs.printingType} onChange={handleInputChange} required>
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
                        <div className="form-group">
                            <label htmlFor="lamination" className="input-label">Inner Lamination</label>
                            <select id="lamination" name="lamination" className="input-box" value={inputs.lamination} onChange={handleInputChange}>
                                <option value="none">--No Lamination--</option>
                                <option value="matt-all">Matt (All Pages)</option>
                                <option value="gloss-all">Gloss (All Pages)</option>
                                <option value="varnish-all">Varnish (All Pages)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="bindingType" className="input-label">Binding Type <span style={{ color: 'red' }}>*</span></label>
                            <select id="bindingType" name="bindingType" className="input-box" value={inputs.bindingType} onChange={handleInputChange} required>
                                <option value="">-- Select Binding --</option>
                                <option value="center-pinning">Center Pinning</option>
                                <option value="section-perfect">Section Binding</option>
                                <option value="perfect-binding">Perfect Binding</option>
                                <option value="loop-pinning">Loop Pinning</option>
                                <option value="wiro">WIRO</option>
                                <option value="hardbound-gally-section">Hardbound Gally Section</option>
                                <option value="top-perfect-pad">Top Perfect Pad</option>
                            </select>
                        </div>
                    </div>
                    {inputs.bindingType !== 'hardbound-gally-section' && (
                        <>
                            <h3 className="text-xl font-semibold mb-4 text-gray-700">Cover Details</h3>
                            <div className="form-grid-modern mb-8">
                                <div className="form-group">
                                    <label htmlFor="coverGsm" className="input-label">Cover GSM</label>
                                    <input type="number" id="coverGsm" name="coverGsm" className="input-box" value={inputs.coverGsm} onChange={(e) => {
                                      const selectedPaper = paperTypes.find(p => p.paperTypeName === inputs.paperType);
                                      const value = parseInt(e.target.value);
                                      if (selectedPaper && selectedPaper.minGsm && selectedPaper.maxGsm) {
                                        if (value < selectedPaper.minGsm || value > selectedPaper.maxGsm) {
                                          setError(`Cover GSM must be between ${selectedPaper.minGsm} and ${selectedPaper.maxGsm} for ${selectedPaper.paperTypeName}`);
                                        } else {
                                          setError('');
                                        }
                                      }
                                      handleInputChange(e);
                                    }} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="coverPrintingColor" className="input-label">Cover Printing Color</label>
                                    <select id="coverPrintingColor" name="coverPrintingColor" className="input-box" value={inputs.coverPrintingColor} onChange={handleInputChange}>
                                        <option value="none">None</option>
                                        <option value="multi">Multi-Color</option>
                                        <option value="single">Single Color</option>
                                        <option value="2+2">2+2 Color</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="coverLamination" className="input-label">Cover Lamination</label>
                                    <select id="coverLamination" name="coverLamination" className="input-box" value={inputs.coverLamination} onChange={handleInputChange}>
                                        <option value="matt">Matt</option>
                                        <option value="gloss">Gloss</option>
                                        <option value="thermal">Thermal - ₹0.85</option>
                                        <option value="velvet">Velvet - ₹3</option>
                                        <option value="varnish">Varnish - ₹0.25</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                    <div className="center-align-container">
                        <div className="toggle-additional" style={{ marginBottom: 16 }}>
                            <button type="button" onClick={() => setShowAdditional(v => !v)} className="save-btn-modern">
                                <span>{showAdditional ? 'Hide Additional Processes' : 'Show Additional Processes'}</span>
                            </button>
                        </div>
                        {showAdditional && (
                            <div className="additional-processes mt-6">
                                <div className="form-grid-modern">
                                    <div className="form-group">
                                        <label htmlFor="uvType" className="input-label">UV Type</label>
                                        <select id="uvType" name="uvType" className="input-box" value={inputs.uvType} onChange={handleInputChange}>
                                            <option value="none">None</option>
                                            <option value="spot-uv-cover">Spot UV on Cover</option>
                                            <option value="raised-uv-cover">Raised UV on Cover</option>
                                            <option value="spot-uv-all-pages">Spot UV on All Pages</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="foilingType" className="input-label">Foiling</label>
                                        <select id="foilingType" name="foilingType" className="input-box" value={inputs.foilingType} onChange={handleInputChange}>
                                            <option value="none">None</option>
                                            <option value="stamp-foil-cover">Stamp Foil on Cover</option>
                                            <option value="magic-gold-foil-cover">Magic Gold Foil on Cover</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="dripUpType" className="input-label">Drip Up</label>
                                        <select id="dripUpType" name="dripUpType" className="input-box" value={inputs.dripUpType} onChange={handleInputChange}>
                                            <option value="none">None</option>
                                            <option value="drip-up-cover">Drip Up on Cover</option>
                                            <option value="drip-up-all-pages">Drip Up on All Pages</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="abc-checkboxes-modern" style={{marginBottom: 16}}>
                            <label className="modern-toggle-label"><input type="checkbox" className="modern-toggle" tabIndex="-1" checked={inputs.checkA} onChange={() => handleAbcCheck('A')} /><span>Nagesh</span></label>
                            <label className="modern-toggle-label"><input type="checkbox" className="modern-toggle" tabIndex="-1" checked={inputs.checkB} onChange={() => handleAbcCheck('B')} /><span>long Run</span></label>
                            <label className="modern-toggle-label"><input type="checkbox" className="modern-toggle" tabIndex="-1" checked={inputs.checkC} onChange={() => handleAbcCheck('C')} /><span>short run</span></label>
                            <label className="modern-toggle-label"><input type="checkbox" className="modern-toggle" tabIndex="-1" name="repetJob" checked={inputs.repetJob} onChange={handleInputChange} /><span>Repet Job</span></label>
                        </div>
                        <button type="button" className="save-btn-modern" onClick={handleCalculate}>Calculate</button>
                    </div>
                </form>
                <Modal show={!!error} onClose={() => setError('')}>
                    <p className="text-lg text-red-600">{error}</p>
                </Modal>
                <Modal show={showPaperModal} onClose={() => setShowPaperModal(false)}>
                    <p className="text-lg mb-4">This paper size fits on both 20x30 and 20x28 sheets. Which size would you like to use?</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => proceedWithCalculation(600)} className="save-btn-modern">Use 20x30</button>
                        <button onClick={() => proceedWithCalculation(560)} className="save-btn-modern">Use 20x28</button>
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
            {results.length > 0 && (
                <div className="cuttosheet-box cuttosheet-result-box">
                    <h4 className="text-lg font-semibold my-4 text-gray-700 text-left">Quotation Summary</h4>

                    <table className="result-table-modern compact-table" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
                        <thead>
                            <tr>
                                <th>Serial Number: {formData && formData.serial ? formData.serial : getNextSerial()}</th>
                                {results.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Quantity</td>
                                {results.map((r, i) => <td key={i}>{r.inputs.qty}</td>)}
                            </tr>
                            <tr>
                                <td>Paper Size</td>
                                {results.map((r, i) => <td key={i}>{capitalizeFirstLetter(r.inputs.size)}</td>)}
                            </tr>
                            <tr>
                                <td>Pages</td>
                                {results.map((r, i) => <td key={i}>{r.inputs.pages}+4, ({r.inputs.pages / 2}+2 Leaves)</td>)}
                            </tr>
                            <tr>
                                <td>GSM</td>
                                {results.map((r, i) => <td key={i}>{r.inputs.gsm} GSM {r.inputs.paperType}</td>)}
                            </tr>

                            <tr>
                                <td>Printing</td>
                                {results.map((r, i) => <td key={i}>{getPrintingDisplayName(r.inputs.printing)}</td>)}
                            </tr>
                            <tr>
                                <td>Inner Lami/Varnish</td>
                                {results.map((r, i) => <td key={i}>{r.inputs.lamination === 'none' ? 'None' : capitalizeFirstLetter(r.inputs.lamination)}</td>)}
                            </tr>
                            <tr>
                                <td>Binding</td>
                                {results.map((r, i) => <td key={i}>{capitalizeFirstLetter(r.inputs.bindingType)}</td>)}
                            </tr>
                            {results.some(r => r.inputs.coverGsm > 0) && (
                                <>
                                    <tr>
                                        <td>Cover GSM</td>
                                        {results.map((r, i) => <td key={i}>{r.inputs.coverGsm > 0 ? r.inputs.coverGsm : '-'}</td>)}
                                    </tr>
                                    <tr>
                                        <td>Cover Printing</td>
                                        {results.map((r, i) => <td key={i}>{r.inputs.coverGsm > 0 ? getPrintingDisplayName(r.inputs.coverPrintingColor) : '-'}</td>)}
                                    </tr>
                                    <tr>
                                        <td>Cover Lamination</td>
                                        {results.map((r, i) => <td key={i}>{r.inputs.coverGsm > 0 ? capitalizeFirstLetter(r.inputs.coverLamination) : '-'}</td>)}
                                    </tr>
                                </>
                            )}
                            {results.some(r => r.inputs.uvType !== 'none') && (
                                <tr>
                                    <td>Fabrication</td>
                                    {results.map((r, i) => <td key={i}>{capitalizeFirstLetter(r.inputs.uvType)}</td>)}
                                </tr>
                            )}
                            {results.some(r => r.inputs.foilingType !== 'none' || r.inputs.dripUpType !== 'none') && (
                                <tr>
                                    <td>Fabrication 2</td>
                                    {results.map((r, i) => <td key={i}>{r.inputs.foilingType !== 'none' ? capitalizeFirstLetter(r.inputs.foilingType) : capitalizeFirstLetter(r.inputs.dripUpType)}</td>)}
                                </tr>
                            )}
                            <tr>
                                <td style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>Total Amt</td>
                                {results.map((r, i) => <td key={i} style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>{formatCurrency(r.finalAmount)}</td>)}
                            </tr>
                            <tr>
                                <td style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>Rate</td>
                                {results.map((r, i) => <td key={i} style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>{formatCurrency(r.bookletRate)}</td>)}
                            </tr>
                            <tr>
                                <td>Action</td>
                                {results.map((r, i) => <td key={i}><button onClick={() => handleDeleteResult(i)} className="delete-btn-modern">-</button></td>)}
                            </tr>
                        </tbody>
                    </table>



                    <div style={{ marginTop: 16, marginBottom: 8, textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Terms & Conditions:</div>
                        <ul style={{ marginLeft: 18, marginBottom: 0 }}>
                            <li>Packing and Boxes Charges will be extra, (only patti packing free)</li>
                            <li>Delivery Charges will be Additional</li>
                            <li style={{ fontSize: '0.92em', color: '#555' }}>GST Extra Applicable</li>
                        </ul>
                    </div>

                    <div className="mt-4 flex gap-4 justify-center">
                        <button type="button" className="save-btn-modern" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : (formData && formData.id ? 'Update Quotation' : 'Save Quotation')}
                        </button>
                        {showFitDetails && processDetails.length > 0 && (
                            <button 
                                type="button" 
                                className="save-btn-modern" 
                                style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
                                onClick={() => {
                                    // Store process details in sessionStorage for Job Card to pick up
                                    sessionStorage.setItem('bookletProcessDetails', JSON.stringify({
                                        quotationNumber: inputs.quotationNumber,
                                        customerName: inputs.customerName,
                                        productName: 'Booklet',
                                        processDetails: processDetails
                                    }));
                                    onNavigate('Job Card');
                                }}
                                title={`Transfer ${processDetails.length} process detail(s) to Job Card`}
                            >
                                → Create Job Card ({processDetails.length} Process{processDetails.length > 1 ? 'es' : ''})
                            </button>
                        )}
                        {hasUnsavedChanges && (
                            <p style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '10px', textAlign: 'center' }}>
                                * You have unsaved changes
                            </p>
                        )}
                    </div>
                    {saveSuccess && <p className="text-green-600 mt-2 text-center">{saveSuccess}</p>}

                    <div className="flex items-center justify-center my-4 gap-4">
                        <div className="flex flex-col items-center gap-2">
                            <label htmlFor="adjustmentPercentage" className="input-label">Percentile Adjust</label>
                            <div className="flex items-center gap-2">
                                <input type="number" id="adjustmentPercentage" value={adjustmentPercentage} onChange={(e) => setAdjustmentPercentage(e.target.value)} className="input-box w-24" placeholder="%"/>
                                <button onClick={() => handleAdjustment('add')} className="save-btn-modern text-lg px-3 py-1">+</button>
                                <button onClick={() => handleAdjustment('subtract')} className="delete-btn-modern text-lg px-3 py-1">-</button>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <label htmlFor="adjustmentAmount" className="input-label">Amount Adjust</label>
                            <div className="flex items-center gap-2">
                                <input type="number" id="adjustmentAmount" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} className="input-box w-24" placeholder="Amt"/>
                                <button onClick={() => handleAmountAdjustment('add')} className="save-btn-modern text-lg px-3 py-1">+</button>
                                <button onClick={() => handleAmountAdjustment('subtract')} className="delete-btn-modern text-lg px-3 py-1">-</button>
                            </div>
                        </div>
                    </div>

                    <h4 className="text-lg font-semibold my-4 text-gray-700 text-left">Cost Breakdown</h4>
                    <table className="result-table-modern compact-table">
                        <thead>
                            <tr>
                                <th>Cost Component</th>
                                {results.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Inner Paper Cost</td>
                                {results.map((r, i) => <td key={i}>{formatCurrency(r.paperCost)}</td>)}
                            </tr>
                            <tr>
                                <td>Inner Printing Cost</td>
                                {results.map((r, i) => <td key={i}>{formatCurrency(r.printingCost)}</td>)}
                            </tr>
                            {results.some(r => r.coverPaperCost > 0) && (
                                <tr>
                                    <td>Cover Paper Cost</td>
                                    {results.map((r, i) => <td key={i}>{formatCurrency(r.coverPaperCost)}</td>)}
                                </tr>
                            )}
                            {results.some(r => r.coverPrintingCost > 0) && (
                                <tr>
                                    <td>Cover Printing Cost</td>
                                    {results.map((r, i) => <td key={i}>{formatCurrency(r.coverPrintingCost)}</td>)}
                                </tr>
                            )}
                            {results.some(r => r.laminationCost > 0) && (
                                <tr>
                                    <td>Inner Lamination</td>
                                    {results.map((r, i) => <td key={i}>{formatCurrency(r.laminationCost)}</td>)}
                                </tr>
                            )}
                            {results.some(r => r.coverLaminationCost > 0) && (
                                <tr>
                                    <td>Cover Lamination</td>
                                    {results.map((r, i) => <td key={i}>{formatCurrency(r.coverLaminationCost)}</td>)}
                                </tr>
                            )}
                            <tr>
                                <td>Binding Cost</td>
                                {results.map((r, i) => <td key={i}>{formatCurrency(r.bindingCost)}</td>)}
                            </tr>
                            {results.some(r => r.uvCost > 0) && (
                                <tr>
                                    <td>UV Cost</td>
                                    {results.map((r, i) => <td key={i}>{formatCurrency(r.uvCost)}</td>)}
                                </tr>
                            )}
                            {results.some(r => r.foilingType !== 'none') && (
                                <tr>
                                    <td>Foiling Cost</td>
                                    {results.map((r, i) => <td key={i}>{formatCurrency(r.foilingCost)}</td>)}
                                </tr>
                            )}
                            {results.some(r => r.dripUpType !== 'none') && (
                                <tr>
                                    <td>DripUp Cost</td>
                                    {results.map((r, i) => <td key={i}>{formatCurrency(r.dripupCost)}</td>)}
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Fit Details Table */}
                    <h4 className="text-lg font-semibold my-4 text-gray-700 text-left">Fit Details</h4>
                    
                    {/* Process Details Section */}
                    {showFitDetails && processDetails.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h4 className="text-lg font-semibold my-4 text-gray-700 text-left">Process Details (Auto-Generated from Quotation #{inputs.quotationNumber})</h4>
                            {processDetails.map((process, index) => (
                                <div key={index} style={{ marginBottom: '1.5rem', padding: '1rem', border: '2px solid #3B82F6', borderRadius: '8px', backgroundColor: '#EFF6FF' }}>
                                    <h5 className="text-md font-semibold mb-2 text-blue-700">Option {process.optionNumber} - Process Details</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                        <div>
                                            <strong>Forms:</strong> {capitalizeFirstLetter(process.forms)}
                                        </div>
                                        <div>
                                            <strong>Side Count:</strong> {process.sideCount}
                                        </div>
                                        <div>
                                            <strong>Total Sheets:</strong> {process.qty}
                                        </div>
                                        <div>
                                            <strong>Wastage:</strong> {process.extraSheets}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                        <div>
                                            <strong>Paper Size:</strong> {process.paperSize}
                                        </div>
                                        <div>
                                            <strong>Fit Sheet Size:</strong> {process.fitSheetSize}
                                        </div>
                                        <div>
                                            <strong>UPS:</strong> {process.ups}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                        <div>
                                            <strong>Printing:</strong> {capitalizeFirstLetter(process.printingType)}
                                        </div>
                                        <div>
                                            <strong>Lamination:</strong> {capitalizeFirstLetter(process.lamination)}
                                        </div>
                                        <div>
                                            <strong>Binding:</strong> {capitalizeFirstLetter(process.binding)}
                                        </div>
                                    </div>
                                    
                                    {/* Detailed Fit Breakdown */}
                                    <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#F8FAFC', borderRadius: '4px' }}>
                                        <strong>Fit Breakdown:</strong>
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                            <div>• Original Quantity: {process.originalQty}</div>
                                            <div>• Pages: {process.pages}</div>
                                            <div>• Inner Forms: {process.innerForms.toFixed(2)} ({process.wholeNumber} whole + {process.fractional.toFixed(2)} fractional)</div>
                                            {process.wholeNumber > 0 && <div>• Frontback Forms: {process.wholeNumber} × {process.originalQty} = {process.wholeNumber * process.originalQty} sheets</div>}
                                            {process.fractional > 0 && <div>• Selfback Forms: {Math.ceil(process.fractional * 4)} × {Math.floor(process.originalQty * process.fractional)} = {Math.ceil(process.fractional * 4) * Math.floor(process.originalQty * process.fractional)} sheets</div>}
                                            <div>• Total with Wastage: {process.qty} sheets</div>
                                        </div>
                                    </div>
                                    
                                    {/* Job Card Transfer Info */}
                                    <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#EFF6FF', borderRadius: '4px', border: '1px solid #3B82F6' }}>
                                        <strong style={{ color: '#1E40AF' }}>Ready for Job Card:</strong>
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
                                            This process detail will be automatically transferred to Job Card when you click "Create Job Card with Process Details" button.
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {results.map((r, optionIndex) => {
                        const selectedPaper = paperOptions.find(p => p.value === r.inputs.size);
                        const ups = selectedPaper?.ups || 1;
                        const innerForms = r.inputs.pages / ups;
                        const wholeNumber = Math.floor(innerForms);
                        const fractional = innerForms - wholeNumber;
                        const wastage = getWastage(r.inputs.qty);
                        
                        let selfBackCount = 0;
                        if (fractional > 0) {
                            if (fractional === 0.5 || fractional === 0.25) {
                                selfBackCount = 1;
                            } else if (fractional === 0.75) {
                                selfBackCount = 2;
                            } else {
                                selfBackCount = Math.ceil(fractional / 0.25);
                            }
                        }
                        
                        return (
                            <div key={optionIndex} style={{ marginBottom: '1.5rem' }}>
                                <h5 className="text-md font-semibold mb-2 text-gray-700">Option {optionIndex + 1} - Fit Details (UPS: {ups}, Fit Sheet Size: {getFitSheetSize(r.inputs.size, r.inputs.printing)})</h5>
                                <table className="result-table-modern compact-table">
                                    <thead>
                                        <tr>
                                            <th>Forms</th>
                                            <th>Count</th>
                                            <th>Sheet</th>
                                            <th>Wastage</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {wholeNumber > 0 && (
                                            <tr>
                                                <td>Frontback</td>
                                                <td>{wholeNumber}</td>
                                                <td>{r.inputs.qty}</td>
                                                <td>{wastage}</td>
                                                <td>{(r.inputs.qty + wastage) * wholeNumber}</td>
                                            </tr>
                                        )}
                                        {selfBackCount > 0 && (
                                            <tr>
                                                <td>Selfback</td>
                                                <td>{selfBackCount}</td>
                                                <td>{Math.floor(r.inputs.qty * fractional)}</td>
                                                <td>{wastage}</td>
                                                <td>{(Math.floor(r.inputs.qty * fractional) + wastage) * selfBackCount}</td>
                                            </tr>
                                        )}
                                        {r.inputs.coverGsm > 0 && (() => {
                                            const coverForms = 4 / ups;
                                            const coverWhole = Math.floor(coverForms);
                                            const coverFractional = coverForms - coverWhole;
                                            const coverWastage = getCoverWastage(r.inputs.qty);
                                            let coverSelfBack = 0;
                                            if (coverFractional > 0) {
                                                if (coverFractional === 0.5 || coverFractional === 0.25) {
                                                    coverSelfBack = 1;
                                                } else if (coverFractional === 0.75) {
                                                    coverSelfBack = 2;
                                                } else {
                                                    coverSelfBack = Math.ceil(coverFractional / 0.25);
                                                }
                                            }
                                            return (
                                                <>
                                                    {coverWhole > 0 && (
                                                        <tr>
                                                            <td>Cover Frontback</td>
                                                            <td>{coverWhole}</td>
                                                            <td>{r.inputs.qty}</td>
                                                            <td>{coverWastage}</td>
                                                            <td>{(r.inputs.qty + coverWastage) * coverWhole}</td>
                                                        </tr>
                                                    )}
                                                    {coverSelfBack > 0 && (
                                                        <tr>
                                                            <td>Cover Selfback</td>
                                                            <td>{coverSelfBack}</td>
                                                            <td>{Math.floor(r.inputs.qty * coverFractional)}</td>
                                                            <td>{coverWastage}</td>
                                                            <td>{(Math.floor(r.inputs.qty * coverFractional) + coverWastage) * coverSelfBack}</td>
                                                        </tr>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}

                </div>
            )}
        </div>
    );
}
