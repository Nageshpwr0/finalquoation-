import React, { useState, useEffect, useMemo } from 'react';
// Import the CSS file
import './CustomCalculator.css';

// --- COMPONENT ---
const CustomCalculator = ({ customers, onNavigate, onSaved, getNextSerial, formData, paperTypes = [], laminationTypes = [], apiUrl }) => {
    // --- STATE MANAGEMENT ---
    const [inputs, setInputs] = useState({
        customerName: '',
        rulingType: 'Variable',
        paperType: 'SBS',
        qty: '1000',
        noOfLeaves: '1',
        jobWidth: '',
        jobHeight: '',
        gsm: '',
        rate: '78',
        printingType: 'bothsides',
        lamination: 'none',
        dieType: '0',
        punching: 'none',
        fabrication: '0',
        fabricationN: '0',
        hcut: '',
        wcut: '',
        ups: '',
        additionalProcess: '0',
        additionalProcessWidth: '',
        additionalProcessHeight: '',
        additionalProcess2: '0',
        additionalProcess2Width: '',
        additionalProcess2Height: '',
        bookletBindingType: 'none',
        bookletCoverGsm: '',
        bookletCoverPrinting: 'none',
        bookletCoverLamination: 'none',
        padBindingType: 'none',
        padCoverGsm: '',
        padCoverPrinting: 'none',
        padCoverLamination: 'none',
        checkA: false,
        checkB: false,
        checkC: false,
        reelcut: false,
    });

    const [results, setResults] = useState([]);
    const [error, setError] = useState('');
    const [showAdditional, setShowAdditional] = useState(false);
    const [showBooklets, setShowBooklets] = useState(false);
    const [showPads, setShowPads] = useState(false);
    const [showBookletCoverOptions, setShowBookletCoverOptions] = useState(true);
    const [showPadCoverOptions, setShowPadCoverOptions] = useState(true);
    const [adjustmentPercentage, setAdjustmentPercentage] = useState(0);
    const [adjustmentAmount, setAdjustmentAmount] = useState(0);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');

    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) {
            return customers;
        }
        return customers.filter(customer =>
            customer.customerName.toLowerCase().includes(customerSearchTerm.toLowerCase())
        );
    }, [customers, customerSearchTerm]);

    // --- EFFECTS ---
    useEffect(() => {
        if (formData && formData.inputs) {
            setInputs(formData.inputs);
            if (formData.results) {
                setResults(formData.results);
            }

            // Logic to show sections when editing
            const {
                dieType, punching, fabrication, fabricationN,
                additionalProcess, additionalProcess2,
                bookletBindingType, padBindingType
            } = formData.inputs;

            if (
                (dieType && dieType !== '0') ||
                (punching && punching !== 'none') ||
                (fabrication && fabrication !== '0') ||
                (fabricationN && fabricationN !== '0') ||
                (additionalProcess && additionalProcess !== '0') ||
                (additionalProcess2 && additionalProcess2 !== '0')
            ) {
                setShowAdditional(true);
            } else {
                setShowAdditional(false);
            }

            if (bookletBindingType && bookletBindingType !== 'none') {
                setShowBooklets(true);
                setShowPads(false);
            } else {
                setShowBooklets(false);
            }

            if (padBindingType && padBindingType !== 'none') {
                setShowPads(true);
                setShowBooklets(false);
            } else {
                setShowPads(false);
            }
        }
    }, [formData]);
    // Effect to set initial paper type defaults
    useEffect(() => {
        if (paperTypes && paperTypes.length > 0) {
            const initialPaper = paperTypes.find(p => p.paperTypeName === 'SBS') || paperTypes[0];
            if (initialPaper) {
                setInputs(prev => ({
                    ...prev,
                    paperType: initialPaper.paperTypeName,
                    rate: String(initialPaper.ratePerKg),
                }));
            }
        }
    }, [paperTypes]);

    useEffect(() => {
        if (!showAdditional) {
            setInputs(prev => ({
                ...prev,
                dieType: '0',
                punching: 'none',
                fabrication: '0',
                fabricationN: '0',
                hcut: '',
                wcut: '',
                ups: '',
                additionalProcess: '0',
                additionalProcessWidth: '',
                additionalProcessHeight: '',
                additionalProcess2: '0',
                additionalProcess2Width: '',
                additionalProcess2Height: '',
            }));
        }
    }, [showAdditional]);

    useEffect(() => {
        if (!showBooklets) {
            setInputs(prev => ({
                ...prev,
                bookletBindingType: 'none',
                bookletCoverGsm: '',
                bookletCoverPrinting: 'none',
                bookletCoverLamination: 'none',
            }));
        }
    }, [showBooklets]);

    useEffect(() => {
        if (!showPads) {
            setInputs(prev => ({
                ...prev,
                padBindingType: 'none',
                padCoverGsm: '',
                padCoverPrinting: 'none',
                padCoverLamination: 'none',
            }));
        }
    }, [showPads]);

    // --- EVENT HANDLERS ---
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        setInputs(prev => {
            const newInputs = { ...prev, [name]: newValue };

            // Handle dependent state changes within the same update to avoid race conditions
            if (name === 'paperType') {
                const selectedPaper = paperTypes.find(p => p.paperTypeName === value);
                if (selectedPaper) {
                    newInputs.rate = String(selectedPaper.ratePerKg);
                }
            }
            
            if (name === 'bookletBindingType' && value !== 'none') {
                newInputs.padBindingType = 'none';
                setShowPadCoverOptions(true);
                setShowBookletCoverOptions(!value.includes('hardbound'));
            }
    
            if (name === 'padBindingType' && value !== 'none') {
                newInputs.bookletBindingType = 'none';
                setShowBookletCoverOptions(true);
                setShowPadCoverOptions(!value.includes('hardbound'));
            }
            return newInputs;
        });
    };
    
    // --- CALCULATION LOGIC ---
    // Note: All calculation functions are kept as they were, but now they consistently receive the `currentInputs` object.
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

    const getStandardSize = (width, height) => { 
        if ((width > 8 && width < 8.5) && (height > 11.5 && height < 12)) return "A4";
        if ((height > 8 && height < 8.5) && (width > 11.5 && width < 12)) return "A4";
        if ((width > 5.5 && width < 6) && (height > 8 && height < 8.5)) return "A5";
        if ((height > 5.5 && height < 6) && (width > 8 && width < 8.5)) return "A5";
        if ((width > 5.25 && width < 5.75) && (height > 8.25 && height < 8.75)) return "Half-Letter";
        if ((height > 5.25 && height < 5.75) && (width > 8.25 && width < 8.75)) return "Half-Letter";
        if ((width > 8.25 && width < 8.75) && (height > 10.75 && height < 11.25)) return "Letter";
        if ((height > 8.25 && height < 8.75) && (width > 10.75 && width < 11.25)) return "Letter";
        if ((width > 6.8 && width < 7.3) && (height > 9.3 && height < 9.7)) return "7.1x9.5";
        if ((height > 6.8 && height < 7.3) && (width > 9.3 && width < 9.7)) return "7.1x9.5";
        if ((width > 6.8 && width < 7.3) && (height > 4.5 && height < 5)) return "7.1x4.75";
        if ((height > 6.8 && height < 7.3) && (width > 4.5 && width < 5)) return "7.1x4.75";
        if ((width > 9.3 && width < 9.7) && (height > 13.3 && height < 13.7)) return "9.5x13.5";
        if ((height > 9.3 && height < 9.7) && (width > 13.3 && width < 13.7)) return "9.5x13.5";
        if ((width > 8.8 && width < 9.2) && (height > 8.8 && height < 9.2)) return "9x9";
        if ((width > 10.8 && width < 11.2) && (height > 10.8 && height < 11.2)) return "11x11";
        if ((width > 11.8 && width < 12.2) && (height > 11.8 && height < 12.2)) return "12x12";
        if ((width > 7.8 && width < 8.2) && (height > 7.8 && height < 8.2)) return "8x8";
        return null;
    }; 
     
    const getPrintingCostParams = (currentInputs) => { 
        let baseCost = 1600, largeBaseCost = 2200, impressionCost = 400, largeImpressionCost = 500; 
        if (currentInputs.checkA) { baseCost = 1250; largeBaseCost = 1250; } 
        if (currentInputs.checkB) { baseCost = 1350; largeBaseCost = 1350; impressionCost = 360; largeImpressionCost = 360; } 
        if (currentInputs.checkC) { baseCost = 1700; largeBaseCost = 1700; } 
        return { baseCost, largeBaseCost, impressionCost, largeImpressionCost }; 
    }; 

    const getBasePrintCost = (currentInputs) => { 
        const currentGsm = parseFloat(currentInputs.gsm) || 0; 
        const currentQty = parseInt(currentInputs.qty) || 0; 
        let currentNoOfLeaves = parseInt(currentInputs.noOfLeaves) || 1; 
        let currentRate = parseFloat(currentInputs.rate) || 0; 

        const specialBindingTypes = ['section-perfect', 'perfect-binding', 'centre-pinning', 'loop-pinning']; 
        const activeBinding = currentInputs.bookletBindingType !== 'none' ? currentInputs.bookletBindingType : currentInputs.padBindingType;
        if (specialBindingTypes.includes(activeBinding)) { 
            currentNoOfLeaves = currentNoOfLeaves / 2; 
        } 

        if (currentInputs.checkA) currentRate -= 3; 
        if (currentInputs.checkB) currentRate -= 2; 

        const parsedJobWidth = parseInputToInches(currentInputs.jobWidth); 
        const parsedJobHeight = parseInputToInches(currentInputs.jobHeight); 

        let bestFit = { cost: Infinity, sheet: null, ups: 0, totalPaperCost: 0, totalPrintingCost: 0, totalDripupCost: 0, grandTotalSheets: 0, printingMethods: [] }; 
        
        let fullSheets; 
        if (currentInputs.reelcut) { 
            fullSheets = [ { width: 19, height: 25.5 }, { width: 20, height: 30 }]; 
        } else if (currentInputs.paperType === "hotmailsticker") { 
            fullSheets = [ { width: 18, height: 25 }, { width: 18, height: 23 }, { width: 15, height: 20 }, { width: 20, height: 30 } ]; 
        } else { 
            fullSheets = [ { width: 18, height: 25 }, { width: 18, height: 23 }, { width: 15, height: 20 }, { width: 20, height: 30 }, { width: 12, height: 23 }, { width: 15, height: 25 }, { width: 12, height: 25 }, { width: 19, height: 25 }, { width: 20, height: 29.5 }, { width: 13, height: 26 }, { width: 14, height: 26 }, { width: 20, height: 28 } ]; 
        } 

        const isSpecialColorJob = currentInputs.printingType.includes('1') || currentInputs.printingType.includes('2');
        if (isSpecialColorJob) {
            fullSheets = fullSheets.filter(sheet => !(sheet.width === 20 && (sheet.height === 30 || sheet.height === 29.5)));
        }

        const bleed = 0.1378; 
        const adjustedWidth = parsedJobWidth + bleed; 
        const adjustedHeight = parsedJobHeight + bleed; 

        if (currentInputs.rulingType === 'Common') { 
            fullSheets.forEach((currentSheet) => { 
                const trimInches = 4 / 25.4; 
                const longSide = Math.max(currentSheet.width, currentSheet.height) - trimInches; 
                const shortSide = Math.min(currentSheet.width, currentSheet.height); 
                const gripper = 0.7; 
                const usableShort = shortSide - gripper; 
                
                const ups1 = Math.floor(longSide / adjustedWidth) * Math.floor(usableShort / adjustedHeight); 
                const ups2 = Math.floor(longSide / adjustedHeight) * Math.floor(usableShort / adjustedWidth); 
                const currentUps = Math.max(ups1, ups2); 

                if (currentUps === 0) return; 

                const sheetsNeeded = Math.ceil((currentQty * currentNoOfLeaves) / currentUps); 
                let wastage = 0; 
                if (sheetsNeeded <= 1500) wastage = 100; else if (sheetsNeeded <= 3000) wastage = 150; else if (sheetsNeeded <= 6000) wastage = 200; 
                else if (sheetsNeeded <= 9000) wastage = 300; else if (sheetsNeeded <= 14000) wastage = 350; else if (sheetsNeeded <= 50000) wastage = 400; else wastage = 600; 
                
                const grandTotalSheets = sheetsNeeded + wastage; 
                
                const paperArea = currentSheet.width * currentSheet.height; 
                const paperWeight = (paperArea * currentGsm * grandTotalSheets) / 1550000; 
                const totalPaperCost = paperWeight * currentRate; 

                let totalPrintingCost = 0; 
                const colorType = currentInputs.printingType.endsWith('1') ? '1' : (currentInputs.printingType.endsWith('2') ? '2' : '4'); 
                
                if (currentInputs.printingType.includes('bothsides')) { 
                    const rounds2 = Math.ceil(grandTotalSheets * 2 / 1000); 
                    if (colorType === '1') { 
                        totalPrintingCost = rounds2 * 150 + 450; 
                    } else if (colorType === '2') { 
                        totalPrintingCost = rounds2 * 200 + 600; 
                    } else { 
                        let { baseCost, impressionCost } = getPrintingCostParams(currentInputs); 
                        totalPrintingCost = rounds2 * impressionCost + baseCost; 
                    } 
                } else { 
                    const rounds = Math.ceil(grandTotalSheets / 1000); 
                    if (colorType === '1') { 
                        totalPrintingCost = rounds * 150 + 450; 
                    } else if (colorType === '2') { 
                        totalPrintingCost = rounds * 200 + 600; 
                    } else { 
                        let { baseCost, impressionCost } = getPrintingCostParams(currentInputs); 
                        totalPrintingCost = rounds * impressionCost + baseCost; 
                    } 
                } 
                
                const totalCost = totalPaperCost + totalPrintingCost; 

                if (totalCost < bestFit.cost) { 
                    bestFit = { 
                        cost: totalCost, sheet: currentSheet, ups: currentUps, totalPaperCost, totalPrintingCost, 
                        totalDripupCost: 0, grandTotalSheets, 
                        runDetails: [{ method: 'Common Rule', sheets: grandTotalSheets, paperCost: totalPaperCost, printingCost: totalPrintingCost, dripupCost: 0 }] 
                    }; 
                } 
            }); 

        } else { 
            fullSheets.forEach((currentSheet) => { 
                const trimInches = 4 / 25.4; 
                const calculationHeight = (currentSheet.width === 20 && currentSheet.height === 30) ? 29.5 : currentSheet.height; 
                let longSide = Math.max(currentSheet.width, calculationHeight) - trimInches; 
                let shortSide = Math.min(currentSheet.width, calculationHeight); 
                
                const isBothSides = currentInputs.printingType.includes('bothsides'); 
                
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

                const isLargeFormatSheet = (currentSheet.width === 20 && (currentSheet.height === 30 || currentSheet.height === 29.5 || currentSheet.height === 28)); 
                const isSpecialColorJob = currentInputs.printingType.includes('1') || currentInputs.printingType.includes('2'); 
                if (isLargeFormatSheet && isSpecialColorJob) return; 

                const getRunCost = (formSize, printingMethod) => { 
                    const sheetsNeeded = Math.ceil(currentQty * formSize); 
                    if (sheetsNeeded === 0) return { paperCost: 0, printingCost: 0, dripupCost: 0, totalSheets: 0, wastage: 0, sheetsNeeded: 0 }; 
                
                    let wastage = 0; 
                    if (sheetsNeeded <= 1500) wastage = 100; else if (sheetsNeeded <= 3000) wastage = 150; else if (sheetsNeeded <= 6000) wastage = 200; 
                    else if (sheetsNeeded <= 9000) wastage = 300; else if (sheetsNeeded <= 14000) wastage = 350; else if (sheetsNeeded <= 50000) wastage = 400; else wastage = 600; 
                
                    const totalSheetsForForm = sheetsNeeded + wastage; 
                
                    let paperCostForForm = 0; 
                    let paperArea;  
                    if (currentInputs.paperType === 'hotmailsticker') { 
                        const hotmailStickerRates = { '18x23': 7, '18x25': 7.5, '20x30': 11, '15x20': 6 }; 
                        const sheetKey = `${currentSheet.width}x${currentSheet.height}`; 
                        const sheetRate = hotmailStickerRates[sheetKey] || 0; 
                        paperCostForForm = sheetRate * totalSheetsForForm; 
                        paperArea = currentSheet.width * currentSheet.height; 
                    } else { 
                        if (currentInputs.reelcut) { 
                            const usedWidth = (final_ups1 > final_ups2) ? Math.floor(longSide / adjustedWidth) * adjustedWidth : Math.floor(longSide / adjustedHeight) * adjustedHeight; 
                            const usedHeight = (final_ups1 > final_ups2) ? Math.floor(finalUsableShort / adjustedHeight) * adjustedHeight : Math.floor(finalUsableShort / adjustedWidth) * adjustedWidth; 
                            paperArea = (usedWidth + 0.75) * (usedHeight + 0.75); 
                        } else if (currentSheet.width === 19 && currentSheet.height === 25) { 
                            paperArea = sheetsNeeded < 2700 ? 600 : 475; 
                        } else if (currentSheet.width === 20 && currentSheet.height === 28) { 
                            paperArea = sheetsNeeded < 2700 ? 600 : 560; 
                        } else { 
                            paperArea = currentSheet.width * currentSheet.height; 
                        } 
                        const paperWeightForForm = (paperArea * currentGsm * totalSheetsForForm) / (1550000); 
                        paperCostForForm = paperWeightForForm * currentRate; 
                    } 
                
                    let printingCostForForm = 0; 
                    const rounds = Math.ceil(sheetsNeeded / 1000); 
                    const rounds2 = Math.ceil(sheetsNeeded * 2 / 1000); 
                    let { baseCost, largeBaseCost, impressionCost, largeImpressionCost } = getPrintingCostParams(currentInputs); 
                
                    if (currentSheet.width === 20 && currentSheet.height === 28) { 
                        largeBaseCost = 2700; 
                        largeImpressionCost = 500; 
                    } 
                
                    if (currentInputs.printingType.startsWith('pantone_')) { 
                        if (isLargeFormatSheet) { 
                            switch (currentInputs.printingType) { 
                                case "pantone_cmyk_bs": printingCostForForm = rounds2 * 800 + 4000; break; 
                                case "pantone_cmyk_os": printingCostForForm = rounds * 800 + 4000; break; 
                                case "pantone_bs": printingCostForForm = rounds2 * 700 + 4500; break; 
                                case "pantone_os": printingCostForForm = rounds * 700 + 4500; break;
                                default: break; 
                            } 
                        } else { 
                            switch (currentInputs.printingType) { 
                                case "pantone_cmyk_bs": printingCostForForm = rounds2 * 600 + 3500; break; 
                                case "pantone_cmyk_os": printingCostForForm = rounds * 600 + 3500; break; 
                                case "pantone_bs": printingCostForForm = rounds2 * 500 + 3000; break; 
                                case "pantone_os": printingCostForForm = rounds * 500 + 3000; break; 
                                default: break;
                            } 
                        } 
                    }  
                    else { 
                        const colorType = currentInputs.printingType.endsWith('1') ? '1' : (currentInputs.printingType.endsWith('2') ? '2' : ''); 
                        const methodForCosting = printingMethod + colorType; 
                    
                        if (isLargeFormatSheet) { 
                            switch (methodForCosting) { 
                                case "selfback": case "doublegripper": printingCostForForm = rounds2 * largeImpressionCost + largeBaseCost; break; 
                                case "frontback": printingCostForForm = (rounds * largeImpressionCost + largeBaseCost) * 2; break; 
                                case "oneside": printingCostForForm = rounds * largeImpressionCost + largeBaseCost; break; 
                                default: break;
                            } 
                        } else { 
                            switch (methodForCosting) { 
                                case "selfback": case "doublegripper": printingCostForForm = rounds2 * impressionCost + baseCost; break; 
                                case "frontback": printingCostForForm = (rounds * impressionCost + baseCost) * 2; break; 
                                case "oneside": printingCostForForm = rounds * impressionCost + baseCost; break; 
                                case "selfback2": case "doublegripper2": printingCostForForm = rounds2 * 200 + 600; break; 
                                case "frontback2": printingCostForForm = (rounds * 200 + 600) * 2; break; 
                                case "oneside2": printingCostForForm = rounds * 200 + 600; break; 
                                case "selfback1": case "doublegripper1": printingCostForForm = rounds2 * 150 + 450; break; 
                                case "frontback1": printingCostForForm = (rounds * 150 + 450) * 2; break; 
                                case "oneside1": printingCostForForm = rounds * 150 + 450; break; 
                                default: break;
                            } 
                        } 
                    } 
                
                    let dripupCostForForm = 0; 
                    if (currentInputs.additionalProcess === 'dripup' || currentInputs.additionalProcess2 === 'dripup') { 
                        let dripupCost = (totalSheetsForForm <= 6000) ? (paperArea * 0.85 * totalSheetsForForm) / 100 + 600 : (paperArea * 0.75 * totalSheetsForForm) / 100 + 600; 
                        dripupCostForForm = Math.max(dripupCost, 6000); 
                    } 
                
                    return { paperCost: paperCostForForm, printingCost: printingCostForForm, dripupCost: dripupCostForForm, totalSheets: totalSheetsForForm, wastage: wastage, sheetsNeeded: sheetsNeeded }; 
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
                            const formSizesForSplitRun = []; 
                            let tempDecimal = decimalPart; 
                            if (tempDecimal >= 0.5) { formSizesForSplitRun.push(0.5); tempDecimal -= 0.5; } 
                            if (tempDecimal >= 0.25) { formSizesForSplitRun.push(0.25); tempDecimal -= 0.25; } 
                            if (tempDecimal > 0) { 
                                if (tempDecimal <= 0.125) { formSizesForSplitRun.push(0.125); } 
                                else if (tempDecimal <= 0.25){ formSizesForSplitRun.push(0.25); } 
                            } 
                            const totalCost_Scenario1 = formSizesForSplitRun.reduce((total, size) => { 
                                const runCost = getRunCost(size, printingMethodForRun); 
                                return total + runCost.paperCost + runCost.printingCost + runCost.dripupCost; 
                            }, 0); 
                            const scenarioB_Method = isBothSides ? 'frontback' : 'oneside'; 
                            const run_B = getRunCost(1.0, scenarioB_Method); 
                            const totalCost_Scenario2 = run_B.paperCost + run_B.printingCost + run_B.dripupCost; 
                            if (totalCost_Scenario1 < totalCost_Scenario2) { 
                                formSizesForSplitRun.forEach(size => runs.push({ formSize: size, method: printingMethodForRun })); 
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
                        dripupCost: res.dripupCost,
                        wastage: res.wastage,
                        sheetsNeeded: res.sheetsNeeded
                    }; 
                }).filter(run => run.sheets > 0); 

                const totalPaperCost = runDetails.reduce((sum, run) => sum + run.paperCost, 0); 
                const totalPrintingCost = runDetails.reduce((sum, run) => sum + run.printingCost, 0); 
                const totalDripupCost = runDetails.reduce((sum, run) => sum + run.dripupCost, 0); 
                const grandTotalSheets = runDetails.reduce((sum, run) => sum + run.sheets, 0); 
                const totalCost = totalPaperCost + totalPrintingCost + totalDripupCost; 

                if (totalCost < bestFit.cost) { 
                    bestFit = { cost: totalCost, sheet: currentSheet, ups: currentUps, totalPaperCost, totalPrintingCost, totalDripupCost, grandTotalSheets, runDetails }; 
                } 
            }); 
        } 
        return bestFit; 
    }; 
    
    const getPostPressCosts = (baseCost, currentInputs) => { 
        const currentQty = parseInt(currentInputs.qty) || 0; 
        let currentNoOfLeaves = parseInt(currentInputs.noOfLeaves) || 1; 
        
        const specialBindingTypes = ['section-perfect', 'perfect-binding', 'centre-pinning', 'loop-pinning']; 
        const activeBinding = currentInputs.bookletBindingType !== 'none' ? currentInputs.bookletBindingType : currentInputs.padBindingType;
        if (specialBindingTypes.includes(activeBinding)) { 
            currentNoOfLeaves = currentNoOfLeaves / 2; 
        } 

        let lamCost = 0; 
        if (baseCost.sheet) { 
            const lamArea = baseCost.sheet.width * baseCost.sheet.height; 
            const selectedLamination = laminationTypes.find(l => l.id === parseInt(currentInputs.lamination));
            if (selectedLamination) {
                const laminationRate = selectedLamination.rate;
                lamCost = (lamArea * laminationRate * baseCost.grandTotalSheets) / 100;
             } 
        } 

        let punchCost = 0; 
        if (currentInputs.punching === "yes") punchCost = Math.ceil(baseCost.grandTotalSheets / 1000) * 400; 
        else if (currentInputs.punching === "stickerpunching") punchCost = Math.ceil(baseCost.grandTotalSheets / 1000) * 800; 

        const totalItemQty = currentQty * currentNoOfLeaves; 
        let fabricationCost = 0, fabRate = 0; 
        if (baseCost.sheet) { 
            const lamArea = baseCost.sheet.width * baseCost.sheet.height; 
            switch (currentInputs.fabrication) { 
                case "singlefold": fabRate = 100; break; case "multifold": fabRate = 150; break; case "cardfolding": fabRate = 300; break; case "threading": fabRate = 300; break; 
                case "pouch": fabRate = 750; break; case "box": fabRate = 600; break; case "tentcard": fabRate = 400; break; case "wobler": fabRate = 1300; break; 
                case "fullgumming": fabricationCost = (lamArea * 1.5 * baseCost.grandTotalSheets) / 100; break; 
                case "lockbottom": fabricationCost = Math.ceil(totalItemQty / 1000) * 600; break; 
                case "selflock": fabricationCost = Math.ceil(totalItemQty / 1000) * 400; break; 
                default: break;
            } 
        } 
        if (fabRate > 0) fabricationCost = Math.ceil(currentQty / 1000) * fabRate * currentNoOfLeaves; 
        
        let fabricationCostN = 0, fabRateN = 0; 
        if (baseCost.sheet) { 
            const lamArea = baseCost.sheet.width * baseCost.sheet.height; 
            switch (currentInputs.fabricationN) { 
                case "singlefoldN": fabRateN = 100; break; case "multifoldN": fabRateN = 150; break; case "cardfoldingN": fabRateN = 300; break; case "threadingN": fabRateN = 300; break; 
                case "pouchN": fabRateN = 750; break; case "boxN": fabRateN = 600; break; case "tentcardN": fabRateN = 400; break; case "woblerN": fabRateN = 1300; break; 
                case "fullgummingN": fabricationCostN = (lamArea * 1.5 * baseCost.grandTotalSheets) / 100; break; 
                case "lockbottomN": fabricationCostN = Math.ceil(totalItemQty / 1000) * 600; break; 
                case "selflockN": fabricationCostN = Math.ceil(totalItemQty / 1000) * 400; break; 
                default: break;
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
                default: break;
            } 
            if (width > 0 && height > 0) { 
                const area = width * height; 
                switch (processValue) { 
                    case "spotuv": case "stampfoil": newCost = area * itemQty * 0.03; break; case "spotuvbs": case "stampfoilbs": newCost = area * itemQty * 0.055; break; 
                    case "raiseduv": newCost = area * itemQty * 0.04; break; case "raiseduvbs": newCost = area * itemQty * 0.06; break; 
                    case "magicfoil": newCost = area * itemQty * 0.065; break; case "magicfoilbs": newCost = area * itemQty * 0.13; break; 
                    default: break;
                } 
            } 
            return Math.max(oldCost, newCost); 
        }; 
        
        let additionalProcessCost = getAdditionalCost(currentInputs.additionalProcess, parseInputToInches(currentInputs.additionalProcessWidth), parseInputToInches(currentInputs.additionalProcessHeight), totalItemQty); 
        let additionalProcessCost2 = getAdditionalCost(currentInputs.additionalProcess2, parseInputToInches(currentInputs.additionalProcess2Width), parseInputToInches(currentInputs.additionalProcess2Height), totalItemQty); 
        
        let halfcuttingAmt = 0; 
        if (currentInputs.fabricationN === 'halfcutting' && currentInputs.hcut > 0 && currentInputs.wcut > 0 && currentInputs.ups > 0 && baseCost.grandTotalSheets > 0) { 
            let hcRate = (currentQty > 10000) ? 0.06 : 0.07; 
            halfcuttingAmt = (parseFloat(currentInputs.wcut) + parseFloat(currentInputs.hcut)) * hcRate * parseFloat(currentInputs.ups) * baseCost.grandTotalSheets; 
            if (halfcuttingAmt > 0 && halfcuttingAmt < 500) halfcuttingAmt = 500; 
        } 

        return { lamCost, dieType: parseFloat(currentInputs.dieType), punchCost, fabricationCost, fabricationCostN, additionalProcessCost, additionalProcessCost2, halfcuttingAmt }; 
    }; 
     
    const getPadBookCosts = (baseCost, currentInputs) => {
        let activeBinding = 'none';
        if (currentInputs.bookletBindingType !== 'none') {
            activeBinding = currentInputs.bookletBindingType;
        } else if (currentInputs.padBindingType !== 'none') {
            activeBinding = currentInputs.padBindingType;
        }
    
        if (activeBinding === 'none') {
            return { total: 0, coverPaperCost: 0, coverPrintingCost: 0, coverLamCost: 0, bindingCost: 0, bindingFixedCost: 0, bindingVariableCost: 0, kappaCost: 0, kappaPaperCost: 0, sectionCost: 0, makingCost: 0, wiroCost: 0, totalCoverSheets: 0 };
        }
    
        const qty = parseInt(currentInputs.qty) || 0;
        const pages = parseInt(currentInputs.noOfLeaves) || 1;
        const coverGsm = parseFloat(currentInputs.bookletBindingType !== 'none' ? currentInputs.bookletCoverGsm : currentInputs.padCoverGsm) || 0;
        const gsm = parseFloat(currentInputs.gsm) || 0;
        const jobWidth = parseInputToInches(currentInputs.jobWidth);
        const jobHeight = parseInputToInches(currentInputs.jobHeight);
        const size = getStandardSize(jobWidth, jobHeight);
    
        let coverPaperCost = 0, coverPrintingCost = 0, coverLamCost = 0, bindingCost = 0, bindingFixedCost = 0, bindingVariableCost = 0;
        let kappaCost = 0, kappaPaperCost = 0, sectionCost = 0, makingCost = 0, wiroCost = 0;
        let totalCoverSheets = 0;
        const coverPrinting = currentInputs.bookletBindingType !== 'none' ? currentInputs.bookletCoverPrinting : currentInputs.padCoverPrinting;
        const coverLamination = currentInputs.bookletBindingType !== 'none' ? currentInputs.bookletCoverLamination : currentInputs.padCoverLamination;
    
        if (coverGsm > 0 && !['rx-pad-binding', 'hardbound-gally', 'hardbound-gally-wiro'].includes(activeBinding)) {
            const coverUps = baseCost.ups > 0 ? baseCost.ups : 1;
    
            if (coverUps > 0) {
                const coverSheetsNeeded = Math.ceil(qty / (coverUps / 2
                    
                ));
    
                let coverWastage = 0;
                if (coverSheetsNeeded <= 1500) coverWastage = 100;
                else if (coverSheetsNeeded <= 3000) coverWastage = 150;
                else if (coverSheetsNeeded <= 6000) coverWastage = 200;
                else if (coverSheetsNeeded <= 9000) coverWastage = 300;
                else if (coverSheetsNeeded <= 14000) coverWastage = 350;
                else if (coverSheetsNeeded <= 50000) coverWastage = 400;
                else coverWastage = 600;
    
                totalCoverSheets = coverSheetsNeeded + coverWastage;
                const sheetArea = baseCost.sheet.width * baseCost.sheet.height;
    
                const paperWeight = (sheetArea * coverGsm * totalCoverSheets) / 1550000;
                coverPaperCost = paperWeight * (parseFloat(currentInputs.rate) || 0);
    
                if (coverPrinting !== 'none') {
                    let { baseCost: printingBaseCost, impressionCost } = getPrintingCostParams(currentInputs);
                    const rounds = Math.ceil(totalCoverSheets / 1000);
                    const rounds2 = Math.ceil(totalCoverSheets * 2 / 1000);
    
                    const colorType = coverPrinting.endsWith('1') ? '1' : (coverPrinting.endsWith('2') ? '2' : '');
                    let printingMethodForCover = 'oneside';
    
                    if (coverPrinting.includes('bothsides')) {
                        const canBeSelfback = (coverUps % 4 === 0) || (coverUps === 2);
                        const canBeDoubleGripper = (coverUps % 2 === 0);
                        printingMethodForCover = 'frontback';
                        if (canBeSelfback) printingMethodForCover = 'selfback';
                        else if (canBeDoubleGripper) printingMethodForCover = 'doublegripper';
                    }
    
                    const methodForCosting = printingMethodForCover + colorType;
    
                    switch (methodForCosting) {
                        case "selfback": case "doublegripper": coverPrintingCost = rounds2 * impressionCost + printingBaseCost; break;
                        case "frontback": coverPrintingCost = (rounds * impressionCost + printingBaseCost) * 2; break;
                        case "oneside": coverPrintingCost = rounds * impressionCost + printingBaseCost; break;
                        case "selfback2": case "doublegripper2": coverPrintingCost = rounds2 * 200 + 600; break;
                        case "frontback2": coverPrintingCost = (rounds * 200 + 600) * 2; break;
                        case "oneside2": coverPrintingCost = rounds * 200 + 600; break;
                        case "selfback1": case "doublegripper1": coverPrintingCost = rounds2 * 150 + 450; break;
                        case "frontback1": coverPrintingCost = (rounds * 150 + 450) * 2; break;
                        case "oneside1": coverPrintingCost = rounds * 150 + 450; break;
                        default: break;
                    }
                }
    
                const selectedCoverLamination = laminationTypes.find(l => l.id === parseInt(coverLamination));
                if (selectedCoverLamination) {
                    const coverLaminationRate = selectedCoverLamination.rate;
                    coverLamCost = (sheetArea * coverLaminationRate * totalCoverSheets) / 100;
                }
            }
        }
    
        switch (activeBinding) {
            case "hardbound-gally":
            case "hardbound-gally-wiro":
                const shortSide = Math.min(jobWidth, jobHeight);
                const longSide = Math.max(jobWidth, jobHeight);
                let kappaWidth, kappaHeight;
    
                if (activeBinding === 'hardbound-gally') {
                    const spine = (pages * 2 * gsm) / 1650;
                    kappaWidth = (shortSide * 2) + spine + 0.5;
                    kappaHeight = longSide + 0.25;
                } else { // hardbound-gally-wiro
                    kappaWidth = (shortSide * 2) + 0.5;
                    kappaHeight = longSide + 0.25;
                }
    
                const kappaBoards = [{ width: 31, height: 41, cost: 60 }, { width: 25, height: 36, cost: 45 }];
                let bestKappa = { costPerPiece: Infinity };
    
                kappaBoards.forEach(board => {
                    const ups1 = Math.floor(board.width / kappaWidth) * Math.floor(board.height / kappaHeight);
                    const ups2 = Math.floor(board.width / kappaHeight) * Math.floor(board.height / kappaWidth);
                    const ups = Math.max(ups1, ups2);
                    if (ups > 0) {
                        const costPerPiece = board.cost / ups;
                        if (costPerPiece < bestKappa.costPerPiece) {
                            bestKappa = { costPerPiece };
                        }
                    }
                });
    
                if (bestKappa.costPerPiece === Infinity) {
                    setError("Could not fit kappa on standard boards.");
                    return { total: null };
                }
                kappaCost = bestKappa.costPerPiece * qty;
    
                const kappaPaperWidth = kappaWidth + 2;
                const kappaPaperHeight = kappaHeight + 2;
                const paperSheets = [{ width: 18, height: 25 }, { width: 18, height: 23 }, { width: 15, height: 20 }, { width: 20, height: 30 }];
                let bestPaper = { cost: Infinity, paperCost: 0, printingCost: 0, totalSheets: 0 };
    
                paperSheets.forEach(sheet => {
                    const ups1 = Math.floor(sheet.width / kappaPaperWidth) * Math.floor(sheet.height / kappaPaperHeight);
                    const ups2 = Math.floor(sheet.width / kappaPaperHeight) * Math.floor(sheet.height / kappaPaperWidth);
                    const ups = Math.max(ups1, ups2);
                    if (ups > 0) {
                        const sheetsNeeded = Math.ceil(qty / ups);
                        const wastage = 100;
                        const totalSheets = sheetsNeeded + wastage;
                        const paperWeight = (sheet.width * sheet.height * 130 * totalSheets) / 1550000;
                        const currentPaperCost = paperWeight * (parseFloat(currentInputs.rate) || 0);
                        const rounds = Math.ceil(totalSheets / 1000);
                        const { baseCost: pBase, impressionCost: pImp } = getPrintingCostParams(currentInputs);
                        const currentPrintingCost = (rounds * pImp) + pBase;
                        const totalCost = currentPaperCost + currentPrintingCost;
                        if (totalCost < bestPaper.cost) {
                            bestPaper = { cost: totalCost, paperCost: currentPaperCost, printingCost: currentPrintingCost, totalSheets: totalSheets };
                        }
                    }
                });
    
                if (bestPaper.cost === Infinity) {
                    setError("Could not fit kappa paper on standard sheets.");
                    return { total: null };
                }
                totalCoverSheets = bestPaper.totalSheets;
                kappaPaperCost = bestPaper.paperCost + bestPaper.printingCost;
    
                if (activeBinding === 'hardbound-gally') {
                    makingCost = 9 * qty;
                    sectionCost = pages * 2 * 0.06 * qty;
                    bindingCost = kappaCost + kappaPaperCost + sectionCost + makingCost;
                } else { // hardbound-gally-wiro
                    makingCost = 5 * qty;
                    const spin = (pages * gsm) / 1700 + 4;
                    let ratePerLoop = 0;
                    if (spin < 7) ratePerLoop = 0.10; else if (spin < 8) ratePerLoop = 0.12; else if (spin < 10) ratePerLoop = 0.18; else if (spin < 13) ratePerLoop = 0.24; else if (spin < 14.5) ratePerLoop = 0.30; else if (spin < 17) ratePerLoop = 0.35; else if (spin < 22.1) ratePerLoop = 0.55; else if (spin < 31) ratePerLoop = 1.6;
                    const loops = longSide * 3;
                    const wiroRate = ((ratePerLoop * loops) + 4) * qty + (qty * pages / baseCost.ups / (pages / 2) * 3);
                    wiroCost = Math.max(wiroRate, 3000);
                    bindingCost = kappaCost + kappaPaperCost + wiroCost + makingCost;
                }
                break;
            case "rx-pad-binding":
                const spineRx = ((pages * 2 * gsm) / 1550000) * 25.4;
                const coverWidthRx = (jobWidth * 2) + spineRx;
                const coverHeightRx = jobHeight + (spineRx + 1) / 2;
    
                const rxFullSheets = [{ width: 18, height: 25 }, { width: 18, height: 23 }, { width: 15, height: 20 }, { width: 20, height: 30 }];
                let bestFitCover = { cost: Infinity, paperCost: 0, printingCost: 0, lamCost: 0, sheet: null, totalSheets: 0 };
    
                rxFullSheets.forEach(sheet => {
                    const ups1 = Math.floor(sheet.width / coverWidthRx) * Math.floor(sheet.height / coverHeightRx);
                    const ups2 = Math.floor(sheet.width / coverHeightRx) * Math.floor(sheet.height / coverWidthRx);
                    const ups = Math.max(ups1, ups2);
    
                    if (ups > 0) {
                        const sheetsNeeded = Math.ceil(qty / ups);
                        let wastage = 100; // Simplified wastage for this specific calculation
                        const totalSheets = sheetsNeeded + wastage;
                        const paperWeight = (sheet.width * sheet.height * coverGsm * totalSheets) / 1550000;
                        const currentPaperCost = paperWeight * (parseFloat(currentInputs.rate) || 0);
    
                        const rounds = Math.ceil(totalSheets / 1000);
                        const { baseCost: pBase, impressionCost: pImp } = getPrintingCostParams(currentInputs);
                        const currentPrintingCost = (rounds * pImp) + pBase;
    
                        let currentLamCost = 0;
                        switch (coverLamination) {
                            case "mattbs": case "glossbs": case "varnishbs": case "thermattbs": case "velmattbs":
                                currentLamCost = (sheet.width * sheet.height * 0.90 * totalSheets) / 100; break;
                            case "mattos": case "glossos": case "varnishos": case "thermattos": case "velmattos":
                                currentLamCost = (sheet.width * sheet.height * 0.45 * totalSheets) / 100; break;
                            default: break;
                        }
    
                        const totalCost = currentPaperCost + currentPrintingCost + currentLamCost;
                        if (totalCost < bestFitCover.cost) {
                            bestFitCover = { cost: totalCost, paperCost: currentPaperCost, printingCost: currentPrintingCost, lamCost: currentLamCost, sheet: sheet, totalSheets: totalSheets };
                        }
                    }
                });
    
                if (bestFitCover.cost === Infinity) {
                    setError("Could not fit RX Pad cover on standard sheets.");
                    return { total: null };
                }
    
                totalCoverSheets = bestFitCover.totalSheets;
                coverPaperCost = bestFitCover.paperCost;
                coverPrintingCost = bestFitCover.printingCost;
                coverLamCost = bestFitCover.lamCost;
                bindingFixedCost = 2500;
                bindingVariableCost = (bestFitCover.totalSheets / 1000 * 400) + (3.5 * qty);
                bindingCost = coverPaperCost + coverPrintingCost + coverLamCost + bindingFixedCost + bindingVariableCost;
                break;
            case "top-gum-pad":
                const kappaBoardWidth = 25;
                const kappaBoardHeight = 36;
                const kappaUps1 = Math.floor(kappaBoardWidth / jobWidth) * Math.floor(kappaBoardHeight / jobHeight);
                const kappaUps2 = Math.floor(kappaBoardWidth / jobHeight) * Math.floor(kappaBoardHeight / jobWidth);
                const kappaUps = Math.max(kappaUps1, kappaUps2);
    
                if (kappaUps > 0) {
                    const kappaCost = 40 / kappaUps;
                    const makingCost = 3;
                    const paperCost = 0.5;
                    let totalPadCost = (kappaCost + makingCost + paperCost) * qty;
    
                    if (qty <= 20) { totalPadCost *= 1.5; }
                    else if (qty <= 40) { totalPadCost *= 1.4; }
                    else if (qty <= 100) { totalPadCost *= 1.3; }
                    else if (qty <= 200) { totalPadCost *= 1.2; }
                    else if (qty <= 500) { totalPadCost *= 1.1; }
                    bindingCost = totalPadCost;
                } else {
                    setError("Job size is too large for Top Gum Pad kappa board.");
                    return { total: null };
                }
                break;
            case "centre-pinning":
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
            case "perfect-binding":
                bindingCost = Math.max(qty * (qty > 2500 ? 0.035 : 0.04) * (pages + 4), 3000);
                break;
            case "top-perfect-pad": {
                const shortSide = Math.min(jobWidth, jobHeight);
                let rate = 0;
    
                if (shortSide < 4.25) {
                    rate = 0.6;
                } else if (shortSide < 6) {
                    rate = 0.8;
                } else if (shortSide < 8.5) {
                    rate = 1.25;
                } else {
                    rate = 2.5;
                }
    
                bindingCost = qty * rate;
                break;
            }
            case "wiro":
                const spin = (pages * gsm) / 1700 + 4;
                let ratePerLoop = 0;
                if (spin < 7) ratePerLoop = 0.10; else if (spin < 8) ratePerLoop = 0.12; else if (spin < 10) ratePerLoop = 0.18; else if (spin < 13) ratePerLoop = 0.24; else if (spin < 14.5) ratePerLoop = 0.30; else if (spin < 17) ratePerLoop = 0.35; else if (spin < 22.1) ratePerLoop = 0.55; else if (spin < 31) ratePerLoop = 1.6;
                else { setError("WIRO binding not available for this combination of pages and GSM."); return { total: null }; }
                const loops = Math.max(jobWidth, jobHeight) * 3;
                const wiroRate = ((ratePerLoop * loops) + 4) * qty + (qty * pages / baseCost.ups / (pages / 2) * 3);
                bindingCost = Math.max(wiroRate, 3000);
                break;
            case "loop-pinning":
                bindingCost = Math.max(qty * (pages <= 100 ? 2 : 1.5), 2500);
                break;
            default: break;
        }
    
        if (currentInputs.paperType === "ArtCard" && activeBinding !== 'none') {
            bindingCost += (pages / 4) * qty * 0.2;
        }

        return { total: coverPaperCost + coverPrintingCost + coverLamCost + bindingCost, coverPaperCost, coverPrintingCost, coverLamCost, bindingCost, bindingFixedCost, bindingVariableCost, kappaCost, kappaPaperCost, sectionCost, makingCost, wiroCost, totalCoverSheets };
    };

    // --- MAIN CALCULATION HANDLER ---
    const handleCalculate = () => {
        // **FIX**: Use the state object directly, don't read from the DOM.
        const currentInputs = { ...inputs };
        
        setError('');

        const requiredFields = {
            customerName: 'Customer Name', paperType: 'Paper Type', qty: 'Quantity',
            jobWidth: 'Job Width', jobHeight: 'Job Height', gsm: 'GSM', printingType: 'Printing'
        };
        if (currentInputs.paperType !== 'hotmailsticker') {
            requiredFields.rate = 'Rate';
        }
        const missingFields = Object.entries(requiredFields)
            .filter(([key]) => !currentInputs[key] || String(currentInputs[key]).trim() === '')
            .map(([, label]) => label);
        
        if (missingFields.length > 0) {
            setError(`Please provide a valid value for: ${missingFields.join(', ')}`);
            return;
        }

        const specialBindingTypes = ['section-perfect', 'perfect-binding', 'centre-pinning', 'loop-pinning'];
        const activeBinding = currentInputs.bookletBindingType !== 'none' ? currentInputs.bookletBindingType : currentInputs.padBindingType;

        if (specialBindingTypes.includes(activeBinding)) {
            if ((parseInt(currentInputs.noOfLeaves) || 0) % 4 !== 0) {
                setError('For the selected binding, leaves must be divisible by 4.');
                return;
            }
        }
        
        const baseCost = getBasePrintCost(currentInputs);
        if (baseCost.cost === Infinity || !baseCost.sheet) {
            setError('Could not find a viable printing option. Please check job dimensions.');
            setResults([]); // Clear previous results on error
            return;
        }

        const postPressCosts = getPostPressCosts(baseCost, currentInputs);
        const padBookCosts = getPadBookCosts(baseCost, currentInputs);
        
        if (padBookCosts.total === null) { // Error is set inside the function
            setResults([]); // Clear previous results on error
            return;
        }
        
        let totalCost = baseCost.totalPaperCost + baseCost.totalPrintingCost + baseCost.totalDripupCost + 
                            postPressCosts.lamCost + postPressCosts.dieType + postPressCosts.punchCost + 
                            postPressCosts.fabricationCost + postPressCosts.fabricationCostN + 
                            postPressCosts.additionalProcessCost + postPressCosts.additionalProcessCost2 + 
                            postPressCosts.halfcuttingAmt + padBookCosts.total;

        const selectedCustomer = customers.find(c => c.customerName === inputs.customerName);
        const margin = selectedCustomer ? parseFloat(selectedCustomer.margin) : 0;

        if (margin > 0) {
            totalCost *= (1 + margin / 100);
        }

        const isBookletOrPad = currentInputs.bookletBindingType !== 'none' || currentInputs.padBindingType !== 'none';
        const finalRate = currentInputs.qty > 0 
            ? (isBookletOrPad ? totalCost / currentInputs.qty : totalCost / (currentInputs.qty * currentInputs.noOfLeaves))
            : 0;

        const newResult = {
            ...currentInputs,
            totalCost,
            finalRate,
            baseCost,
            postPressCosts,
            padBookCosts,
            bestFitDetails: { sheet: baseCost.sheet, ups: baseCost.ups, grandTotalSheets: baseCost.grandTotalSheets, runDetails: baseCost.runDetails }
        };

        setResults(prevResults => [...prevResults, newResult]);
    };

    const handleAdjustment = (direction) => {
        const percentage = parseFloat(adjustmentPercentage) || 0;
        if (percentage === 0) return;

        const multiplier = direction === 'add' ? (1 + percentage / 100) : (1 - percentage / 100);

        setResults(prevResult => prevResult.map(r => {
            const newTotalCost = r.totalCost * multiplier;
            const newFinalRate = newTotalCost / (r.qty * r.noOfLeaves);
            return { ...r, totalCost: newTotalCost, finalRate: newFinalRate };
        }));
    };

    const handleAmountAdjustment = (direction) => {
        const amount = parseFloat(adjustmentAmount) || 0;
        if (amount === 0) return;

        const adjustment = direction === 'add' ? amount : -amount;

        setResults(prevResult => prevResult.map(r => {
            const newTotalCost = r.totalCost + adjustment;
            const newFinalRate = newTotalCost / (r.qty * r.noOfLeaves);
            return { ...r, totalCost: newTotalCost, finalRate: newFinalRate };
        }));
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

        const quotationData = {
            productType: 'Custom Calculator',
            serial: formData && formData.serial ? formData.serial : getNextSerial(),
            customerName: inputs.customerName,
            inputs: {
                ...inputs,
            },
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
            if (onSaved) {
                onSaved(savedQuotation);
            }
        })
        .catch(error => {
            console.error('Error saving quotation:', error);
            setError('Failed to save quotation. Please try again.');
        });
    };
    
    const deleteResult = (index) => {
        setResults(prev => prev.filter((_, i) => i !== index));
    };
    
    // --- JSX RENDER ---
    return (
        <div className={`cuttosheet-flex-container ${results.length > 0 ? 'results-visible' : ''}`}>
            <div className="cuttosheet-box cuttosheet-form-box">
                <h1 className="form-title-pink">Custom Calculation</h1>
                <div className="cut-to-sheet-form">
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
                            <label htmlFor="rulingType" className="input-label">Ruling</label>
                            <select id="rulingType" name="rulingType" className="input-box" value={inputs.rulingType} onChange={handleInputChange}>
                                <option value="Variable">Variable</option>
                                <option value="Common">Common</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="paperType" className="input-label">Paper Type <span style={{color:'red'}}>*</span></label>
                            <select id="paperType" name="paperType" className="input-box" value={inputs.paperType} onChange={handleInputChange}>
                                {paperTypes && paperTypes.map(p => <option key={p.id || p.paperTypeName} value={p.paperTypeName}>{p.paperTypeName}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="qty" className="input-label">Quantity <span style={{color:'red'}}>*</span></label>
                            <input id="qty" name="qty" type="number" className="input-box" value={inputs.qty} onChange={handleInputChange}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="noOfLeaves" className="input-label">No of Leaves/Design</label>
                            <input id="noOfLeaves" name="noOfLeaves" type="number" className="input-box" value={inputs.noOfLeaves} onChange={handleInputChange}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="jobWidth" className="input-label">Job Width (inch/mm) <span style={{color:'red'}}>*</span></label>
                            <input id="jobWidth" name="jobWidth" type="text" className="input-box" value={inputs.jobWidth} onChange={handleInputChange}/>
                        </div>
                         <div className="form-group">
                            <label htmlFor="jobHeight" className="input-label">Job Height (inch/mm) <span style={{color:'red'}}>*</span></label>
                            <input id="jobHeight" name="jobHeight" type="text" className="input-box" value={inputs.jobHeight} onChange={handleInputChange}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="gsm" className="input-label">GSM <span style={{color:'red'}}>*</span></label>
                            <input id="gsm" name="gsm" type="number" className="input-box" value={inputs.gsm} onChange={handleInputChange}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="rate" className="input-label">Rate <span style={{color:'red'}}>*</span></label>
                            <input id="rate" name="rate" type="number" className="input-box" value={inputs.rate} onChange={handleInputChange}/>
                        </div>
                        <div className="form-group full-width">
                             <label htmlFor="printingType" className="input-label">Printing <span style={{color:'red'}}>*</span></label>
                            <select id="printingType" name="printingType" className="input-box" value={inputs.printingType} onChange={handleInputChange}>
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
                            </select>
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="lamination" className="input-label">Lamination / Varnish</label>
                            <select id="lamination" name="lamination" className="input-box" value={inputs.lamination} onChange={handleInputChange}>
                                 <option value="none">None</option>
                                 <option value="mattos">Matt Lamination O/S</option>
                                 {laminationTypes && laminationTypes.map(lamination => (
                                   <option key={lamination.id} value={lamination.id}>
                                     {lamination.laminationName}
                                   </option>
                                 ))}
                            </select>
                        </div>
                    </div>

                     <div className="text-center flex justify-center gap-4" style={{margin: '20px 0'}}>
                        <button 
                            type="button" 
                            onClick={() => setShowAdditional(!showAdditional)} 
                            className={`toggle-btn-modern ${showAdditional ? 'active' : ''}`}
                        >
                            Additional Processes {showAdditional ? '▲' : '▼'}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => { setShowBooklets(!showBooklets); setShowPads(false); }} 
                            className={`toggle-btn-modern ${showBooklets ? 'active' : ''}`}
                        >
                            Booklets {showBooklets ? '▲' : '▼'}
                        </button>
                         <button 
                            type="button" 
                            onClick={() => { setShowPads(!showPads); setShowBooklets(false); }} 
                            className={`toggle-btn-modern ${showPads ? 'active' : ''}`}
                         >
                            Pads {showPads ? '▲' : '▼'}
                        </button>
                    </div>
                    
                    {showAdditional && (
                        <div>
                            <h3 className="form-title-pink" style={{fontSize: '1.2em', marginBottom: '15px'}}>Additional Processes</h3>
                            <div className="form-grid-modern">
                               <div className="form-group">
                                    <label htmlFor="dieType" className="input-label">Die</label>
                                    <select id="dieType" name="dieType" className="input-box" value={inputs.dieType} onChange={handleInputChange}>
                                        <option value="0">None</option>
                                        <option value="1500">Small-Punch</option>
                                        <option value="2000">Medium-Punch</option>
                                        <option value="3000">Big-Punch</option>
                                    </select>
                               </div>
                               <div className="form-group">
                                    <label htmlFor="punching" className="input-label">Punching</label>
                                    <select id="punching" name="punching" className="input-box" value={inputs.punching} onChange={handleInputChange}>
                                        <option value="none">None</option>
                                        <option value="yes">Yes</option>
                                        <option value="stickerpunching">Sticker Punching</option>
                                    </select>
                               </div>
                               <div className="form-group">
                                    <label htmlFor="fabrication" className="input-label">Fabrication</label>
                                    <select id="fabrication" name="fabrication" className="input-box" value={inputs.fabrication} onChange={handleInputChange}>
                                        <option value="0">None</option><option value="singlefold">Single fold</option><option value="multifold">Multi fold</option><option value="cardfolding">Card folding</option><option value="threading">Threading</option><option value="pouch">Pouch Pasting</option><option value="box">Box Pasting</option><option value="wobler">Wobler</option><option value="tentcard">Tent Card Pasting</option><option value="fullgumming">Full Gumming</option><option value="lockbottom">Lock Bottom & Side Pasting</option><option value="selflock">Self lock Side Pasting</option>
                                    </select>
                               </div>
                               <div className="form-group">
                                    <label htmlFor="fabricationN" className="input-label">Fabrication 2</label>
                                    <select id="fabricationN" name="fabricationN" className="input-box" value={inputs.fabricationN} onChange={handleInputChange}>
                                        <option value="0">None</option><option value="singlefoldN">Single fold</option><option value="multifoldN">Multi fold</option><option value="cardfoldingN">Card folding</option><option value="threadingN">Threading</option><option value="pouchN">Pouch Pasting</option><option value="boxN">Box Pasting</option><option value="woblerN">Wobler</option><option value="halfcutting">Half Cutting</option><option value="tentcardN">Tent Card Pasting</option><option value="fullgummingN">Full Gumming</option><option value="lockbottomN">Lock Bottom & Side Pasting</option><option value="selflockN">Self lock Side Pasting</option>
                                    </select>
                               </div>
                                {inputs.fabricationN === 'halfcutting' && (
                                     <div className="full-width grid grid-cols-2 gap-4">
                                        <div className="form-group"><label htmlFor="hcut" className="input-label">H-Cut</label><input id="hcut" name="hcut" type="number" className="input-box" value={inputs.hcut} onChange={handleInputChange}/></div>
                                        <div className="form-group"><label htmlFor="wcut" className="input-label">W-Cut</label><input id="wcut" name="wcut" type="number" className="input-box" value={inputs.wcut} onChange={handleInputChange}/></div>
                                        <div className="form-group"><label htmlFor="ups" className="input-label">Ups</label><input id="ups" name="ups" type="number" className="input-box" value={inputs.ups} onChange={handleInputChange}/></div>
                                     </div>
                                )}
                               <div className="form-group">
                                    <label htmlFor="additionalProcess" className="input-label">Additional Process 1</label>
                                    <select id="additionalProcess" name="additionalProcess" className="input-box" value={inputs.additionalProcess} onChange={handleInputChange}>
                                        <option value="0">None</option><option value="dripup">Drip Up</option><option value="spotuv">Spot UV</option><option value="raiseduv">Raised UV</option><option value="stampfoil">Stamp Foiling</option><option value="magicfoil">Magic Foil</option><option value="spotuvbs">Spot UV BS</option><option value="raiseduvbs">Raised UV BS</option><option value="stampfoilbs">Stamp Foiling BS</option><option value="magicfoilbs">Magic Foil BS</option>
                                    </select>
                               </div>
                               {['spotuv', 'raiseduv', 'stampfoil', 'magicfoil', 'spotuvbs', 'raiseduvbs', 'stampfoilbs', 'magicfoilbs'].includes(inputs.additionalProcess) && (
                                    <div className="full-width grid grid-cols-2 gap-4">
                                        <div className="form-group"><label htmlFor="additionalProcessWidth" className="input-label">Width (inch/mm)</label><input id="additionalProcessWidth" name="additionalProcessWidth" type="text" className="input-box" value={inputs.additionalProcessWidth} onChange={handleInputChange}/></div>
                                        <div className="form-group"><label htmlFor="additionalProcessHeight" className="input-label">Height (inch/mm)</label><input id="additionalProcessHeight" name="additionalProcessHeight" type="text" className="input-box" value={inputs.additionalProcessHeight} onChange={handleInputChange}/></div>
                                    </div>
                               )}
                               <div className="form-group">
                                    <label htmlFor="additionalProcess2" className="input-label">Additional Process 2</label>
                                    <select id="additionalProcess2" name="additionalProcess2" className="input-box" value={inputs.additionalProcess2} onChange={handleInputChange}>
                                         <option value="0">None</option><option value="dripup">Drip Up</option><option value="spotuv">Spot UV</option><option value="raiseduv">Raised UV</option><option value="stampfoil">Stamp Foiling</option><option value="magicfoil">Magic Foil</option><option value="spotuvbs">Spot UV BS</option><option value="raiseduvbs">Raised UV BS</option><option value="stampfoilbs">Stamp Foiling BS</option><option value="magicfoilbs">Magic Foil BS</option>
                                    </select>
                               </div>
                               {['spotuv', 'raiseduv', 'stampfoil', 'magicfoil', 'spotuvbs', 'raiseduvbs', 'stampfoilbs', 'magicfoilbs'].includes(inputs.additionalProcess2) && (
                                    <div className="full-width grid grid-cols-2 gap-4">
                                        <div className="form-group"><label htmlFor="additionalProcess2Width" className="input-label">Width (inch/mm)</label><input id="additionalProcess2Width" name="additionalProcess2Width" type="text" className="input-box" value={inputs.additionalProcess2Width} onChange={handleInputChange}/></div>
                                        <div className="form-group"><label htmlFor="additionalProcess2Height" className="input-label">Height (inch/mm)</label><input id="additionalProcess2Height" name="additionalProcess2Height" type="text" className="input-box" value={inputs.additionalProcess2Height} onChange={handleInputChange}/></div>
                                    </div>
                               )}
                            </div>
                        </div>
                    )}
                    
                    {showBooklets && (
                         <div>
                             <h3 className="form-title-pink" style={{fontSize: '1.2em', marginBottom: '15px'}}>Booklets</h3>
                             <div className="form-grid-modern">
                                 <div className="form-group">
                                     <label htmlFor="bookletBindingType" className="input-label">Binding Type</label>
                                     <select id="bookletBindingType" name="bookletBindingType" className="input-box" value={inputs.bookletBindingType} onChange={handleInputChange}>
                                         <option value="none">None</option><option value="hardbound-gally">Hardbound Gally</option><option value="hardbound-gally-wiro">Hardbound Gally-Wiro</option><option value="wiro">Wiro</option><option value="section-perfect">Section Perfect</option><option value="perfect-binding">Perfect Binding</option><option value="centre-pinning">Centre Pinning</option><option value="loop-pinning">Loop Pinning</option>
                                     </select>
                                 </div>
                                 {showBookletCoverOptions && <>
                                     <div className="form-group"><label htmlFor="bookletCoverGsm" className="input-label">Cover GSM</label><input id="bookletCoverGsm" name="bookletCoverGsm" type="number" className="input-box" value={inputs.bookletCoverGsm} onChange={handleInputChange}/></div>
                                     <div className="form-group"><label htmlFor="bookletCoverPrinting" className="input-label">Cover Printing</label><select id="bookletCoverPrinting" name="bookletCoverPrinting" className="input-box" value={inputs.bookletCoverPrinting} onChange={handleInputChange}><option value="none">None</option><option value="bothsides">Both Sides (4+4 Color)</option><option value="oneside">One Side (4+0 Color)</option><option value="bothsides2">Both Sides (2+2 Color)</option><option value="oneside2">One Side (2+0 Color)</option><option value="bothsides1">Both Sides (1+1 Color)</option><option value="oneside1">One Side (1+0 Color)</option></select></div>
                                     <div className="form-group"><label htmlFor="bookletCoverLamination" className="input-label">Cover Lamination</label><select id="bookletCoverLamination" name="bookletCoverLamination" className="input-box" value={inputs.bookletCoverLamination} onChange={handleInputChange}><option value="none">None</option>{laminationTypes && laminationTypes.map(lamination => (<option key={lamination.id} value={lamination.id}>{lamination.laminationName}</option>))}</select></div>
                                 </>}
                             </div>
                         </div>
                    )}

                    {showPads && (
                        <div>
                             <h3 className="form-title-pink" style={{fontSize: '1.2em', marginBottom: '15px'}}>Pads</h3>
                             <div className="form-grid-modern">
                                 <div className="form-group">
                                     <label htmlFor="padBindingType" className="input-label">Binding Type</label>
                                     <select id="padBindingType" name="padBindingType" className="input-box" value={inputs.padBindingType} onChange={handleInputChange}>
                                         <option value="none">None</option><option value="hardbound-gally">Hardbound Gally</option><option value="hardbound-gally-wiro">Hardbound Gally-Wiro</option><option value="rx-pad-binding">RX Pad Binding</option><option value="top-gum-pad">Top Gum Pad</option><option value="wiro">Wiro</option><option value="top-perfect-pad">Top Perfect Pad</option>
                                     </select>
                                 </div>
                                  {showPadCoverOptions && <>
                                     <div className="form-group"><label htmlFor="padCoverGsm" className="input-label">Cover GSM</label><input id="padCoverGsm" name="padCoverGsm" type="number" className="input-box" value={inputs.padCoverGsm} onChange={handleInputChange}/></div>
                                     <div className="form-group"><label htmlFor="padCoverPrinting" className="input-label">Cover Printing</label><select id="padCoverPrinting" name="padCoverPrinting" className="input-box" value={inputs.padCoverPrinting} onChange={handleInputChange}><option value="none">None</option><option value="bothsides">Both Sides (4+4 Color)</option><option value="oneside">One Side (4+0 Color)</option><option value="bothsides2">Both Sides (2+2 Color)</option><option value="oneside2">One Side (2+0 Color)</option><option value="bothsides1">Both Sides (1+1 Color)</option><option value="oneside1">One Side (1+0 Color)</option></select></div>
                                     <div className="form-group"><label htmlFor="padCoverLamination" className="input-label">Cover Lamination</label><select id="padCoverLamination" name="padCoverLamination" className="input-box" value={inputs.padCoverLamination} onChange={handleInputChange}><option value="none">None</option>{laminationTypes && laminationTypes.map(lamination => (<option key={lamination.id} value={lamination.id}>{lamination.laminationName}</option>))}</select></div>
                                 </>}
                             </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center mt-8 gap-4">
                        <div className="checkbox-grid">
                            <label className="modern-toggle-label"><input type="checkbox" name="checkA" checked={inputs.checkA} onChange={handleInputChange}/> A</label>
                            <label className="modern-toggle-label"><input type="checkbox" name="checkB" checked={inputs.checkB} onChange={handleInputChange}/> B</label>
                            <label className="modern-toggle-label"><input type="checkbox" name="checkC" checked={inputs.checkC} onChange={handleInputChange}/> C</label>
                            <label className="modern-toggle-label"><input type="checkbox" name="reelcut" checked={inputs.reelcut} onChange={handleInputChange}/> Reel Cut</label>
                        </div>
                        <button onClick={handleCalculate} type="button" className="save-btn-modern py-3 px-8 text-lg">Calculate</button>
                    </div>
                </div>
                {error && <div className="error-message">{error}</div>}
            </div>

            {results.length > 0 && (
                <div className="cuttosheet-box cuttosheet-result-box">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">Quotation Details</h3>
                    
                    {/* Quotation Details Table */}
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
                                {results.some(r => r.noOfLeaves > 1) && (
                                    <tr>
                                        <td>Leaves/Designs</td>
                                        {results.map((r, i) => <td key={i}>{r.noOfLeaves}</td>)}
                                    </tr>
                                )}
                                <tr>
                                    <td>Size</td>
                                    {results.map((r, i) => <td key={i}>{`${r.jobWidth}" x ${r.jobHeight}"`}</td>)}
                                </tr>
                                <tr>
                                    <td>GSM</td>
                                    {results.map((r, i) => <td key={i}>{r.gsm} GSM {r.paperType}</td>)}
                                </tr>
                                <tr>
                                    <td>Printing</td>
                                    {results.map((r, i) => <td key={i}>{r.printingType.replace('bothsides', 'Both Sides').replace('oneside', 'One Side')}</td>)}
                                </tr>
                                {results.some(r => r.lamination !== 'none') && (
                                    <tr>
                                        <td>Lamination</td>
                                        {results.map((r, i) => <td key={i}>{r.lamination}</td>)}
                                    </tr>
                                )}
                                {results.some(r => r.dieType && r.dieType !== '0') && (
                                    <tr>
                                        <td>Die</td>
                                        {results.map((r, i) => <td key={i}>{r.dieType}</td>)}
                                    </tr>
                                )}
                                {results.some(r => r.punching && r.punching !== 'none') && (
                                    <tr>
                                        <td>Punching</td>
                                        {results.map((r, i) => <td key={i}>{r.punching}</td>)}
                                    </tr>
                                )}
                                {results.some(r => r.fabrication && r.fabrication !== '0') && (
                                    <tr>
                                        <td>Fabrication</td>
                                        {results.map((r, i) => <td key={i}>{r.fabrication}</td>)}
                                    </tr>
                                )}
                                {results.some(r => r.fabricationN && r.fabricationN !== '0') && (
                                    <tr>
                                        <td>Fabrication 2</td>
                                        {results.map((r, i) => <td key={i}>{r.fabricationN}</td>)}
                                    </tr>
                                )}
                                {results.some(r => r.additionalProcess && r.additionalProcess !== '0') && (
                                    <tr>
                                        <td>Additional Process 1</td>
                                        {results.map((r, i) => <td key={i}>{r.additionalProcess}</td>)}
                                    </tr>
                                )}
                                {results.some(r => r.additionalProcess2 && r.additionalProcess2 !== '0') && (
                                    <tr>
                                        <td>Additional Process 2</td>
                                        {results.map((r, i) => <td key={i}>{r.additionalProcess2}</td>)}
                                    </tr>
                                )}
                                {results.some(r => r.bookletBindingType && r.bookletBindingType !== 'none') && (
                                    <tr>
                                        <td>Booklet Binding</td>
                                        {results.map((r, i) => <td key={i}>{r.bookletBindingType}</td>)}
                                    </tr>
                                )}
                                {results.some(r => r.padBindingType && r.padBindingType !== 'none') && (
                                    <tr>
                                        <td>Pad Binding</td>
                                        {results.map((r, i) => <td key={i}>{r.padBindingType}</td>)}
                                    </tr>
                                )}
                                <tr style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>
                                    <td>Total Amt</td>
                                    {results.map((r, i) => <td key={i}>₹{r.totalCost.toFixed(2)}</td>)}
                                </tr>
                                <tr style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>
                                    <td>Rate</td>
                                    {results.map((r, i) => <td key={i}>₹{r.finalRate.toFixed(2)}</td>)}
                                </tr>
                                <tr>
                                    <td>Action</td>
                                    {results.map((r, i) => (
                                        <td key={i} className="action-buttons">
                                            <button onClick={() => deleteResult(i)} className="delete-btn-modern small">-</button>
                                        </td>
                                    ))}
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
                        <button type="button" onClick={handleSave} className="save-btn-modern py-3 px-8 text-lg">
                            {formData ? 'Update Quotation' : 'Save Quotation'}
                        </button>
                    </div>

                    {/* Rate Adjustment */}
                    <div className="flex items-center justify-center my-4 gap-4 p-4 border-t border-gray-200">
                        <div className="flex flex-col items-center gap-2">
                            <label htmlFor="adjustmentPercentage" className="input-label">Percentile Adjust</label>
                            <div className="flex items-center gap-2">
                                <input 
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
                                <input 
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
                                    {results.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Best Fit Sheet</td>
                                    {results.map((r, i) => <td key={i}>{r.bestFitDetails.sheet ? `${r.bestFitDetails.sheet.width}" x ${r.bestFitDetails.sheet.height}"` : '-'}</td>)}
                                </tr>
                                <tr>
                                    <td>Inner sheets</td>
                                    {results.map((r, i) => <td key={i}>{r.bestFitDetails.grandTotalSheets || '-'}</td>)}
                                </tr>
                                {results.some(r => r.padBookCosts && r.padBookCosts.totalCoverSheets > 0) && (
                                    <tr>
                                        <td>Cover sheet</td>
                                        {results.map((r, i) => <td key={i}>{r.padBookCosts.totalCoverSheets || '-'}</td>)}
                                    </tr>
                                )}
                                <tr>
                                    <td>UPS</td>
                                    {results.map((r, i) => <td key={i}>{r.bestFitDetails.ups || '-'}</td>)}
                                </tr>
                                {results.some(r => r.checkA) && <tr><td>Check A</td>{results.map((r, i) => <td key={i}>{r.checkA ? 'Yes' : '-'}</td>)}</tr>}
                                {results.some(r => r.checkB) && <tr><td>Check B</td>{results.map((r, i) => <td key={i}>{r.checkB ? 'Yes' : '-'}</td>)}</tr>}
                                {results.some(r => r.checkC) && <tr><td>Check C</td>{results.map((r, i) => <td key={i}>{r.checkC ? 'Yes' : '-'}</td>)}</tr>}
                                {results.some(r => r.reelcut) && <tr><td>Reel Cut</td>{results.map((r, i) => <td key={i}>{r.reelcut ? 'Yes' : '-'}</td>)}</tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Cost Breakdown Table */}
                    <div className="overflow-x-auto mb-4">
                        <h4 className="text-lg font-semibold mb-3 text-gray-700">Cost Breakdown</h4>
                        <table className="result-table-modern compact-table">
                            <thead>
                                <tr>
                                    <th>Details</th>
                                    {results.map((_, i) => <th key={i}>Option {i + 1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const groupedResultsData = results.map(r => {
                                        const groupedRuns = (r.bestFitDetails.runDetails || []).reduce((acc, run) => {
                                            const key = `${run.method}|${run.paperCost.toFixed(2)}|${run.printingCost.toFixed(2)}`;
                                            if (!acc[key]) {
                                                acc[key] = { ...run, count: 0 };
                                            }
                                            acc[key].count++;
                                            return acc;
                                        }, {});
                                        return { ...r, groupedRuns: Object.values(groupedRuns) };
                                    });

                                    const allKeys = new Set();
                                    groupedResultsData.forEach(r => {
                                        r.groupedRuns.forEach((run, j) => {
                                            allKeys.add(`run-${j}`);
                                        });
                                        Object.keys(r.postPressCosts).forEach(key => {
                                            if (r.postPressCosts[key] > 0) allKeys.add(key);
                                        });
                                        if (r.padBookCosts && r.padBookCosts.total > 0) {
                                            Object.keys(r.padBookCosts).forEach(key => {
                                                if (r.padBookCosts[key] > 0 && key !== 'total' && key !== 'totalCoverSheets') allKeys.add(key);
                                            });
                                        }
                                    });

                                    const sortedKeys = Array.from(allKeys).sort((a, b) => {
                                        if (a.startsWith('run-') && !b.startsWith('run-')) return -1;
                                        if (!a.startsWith('run-') && b.startsWith('run-')) return 1;
                                        return a.localeCompare(b);
                                    });

                                    return sortedKeys.map(key => {
                                        if (key.startsWith('run-')) {
                                            const runIndex = parseInt(key.split('-')[1], 10);
                                            const firstResultWithRun = groupedResultsData.find(r => r.groupedRuns[runIndex]);
                                            if (!firstResultWithRun) return null;
                                            
                                            const runData = firstResultWithRun.groupedRuns[runIndex];
                                            const runLabel = `${runData.method}${runData.count > 1 ? ` x ${runData.count}` : ''}`;

                                            return (
                                                <React.Fragment key={`run-frag-${runIndex}`}>
                                                    <tr>
                                                        <td className="font-semibold">{runLabel} - Paper Cost</td>
                                                        {groupedResultsData.map((r, i) => (
                                                            <td key={`run-${runIndex}-paper-${i}`}>
                                                                {r.groupedRuns[runIndex] ? `₹${(r.groupedRuns[runIndex].paperCost * r.groupedRuns[runIndex].count).toFixed(2)}` : '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                    <tr>
                                                        <td className="font-semibold">{runLabel} - Printing Cost</td>
                                                        {groupedResultsData.map((r, i) => (
                                                            <td key={`run-${runIndex}-printing-${i}`}>
                                                                {r.groupedRuns[runIndex] ? `₹${(r.groupedRuns[runIndex].printingCost * r.groupedRuns[runIndex].count).toFixed(2)}` : '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        } else {
                                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                            return (
                                                <tr key={key}>
                                                    <td className="font-semibold">{label}</td>
                                                    {results.map((r, i) => {
                                                        let value = 0;
                                                        if (r.postPressCosts[key] !== undefined) {
                                                            value = r.postPressCosts[key];
                                                        } else if (r.padBookCosts && r.padBookCosts[key] !== undefined) {
                                                            value = r.padBookCosts[key];
                                                        }
                                                        return <td key={`${key}-${i}`}>₹{value.toFixed(2)}</td>;
                                                    })}
                                                </tr>
                                            );
                                        }
                                    });
                                })()}
                                <tr style={{ backgroundColor: '#EAEAEA', fontWeight: 'bold' }}>
                                    <td>Total Cost</td>
                                    {results.map((r, i) => (
                                        <td key={`total-${i}`}>₹{r.totalCost.toFixed(2)}</td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomCalculator;
