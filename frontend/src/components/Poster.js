import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const Poster = ({ formData, onSaved, getNextSerial, customers, paperTypes = [], onAddNewCustomer, apiUrl, onNavigate }) => {
    const [inputs, setInputs] = useState({
        quantity: 1000,
        paperType: '78',
        paperTypeText: 'Art Paper',
        gsm: 90,
        posterSize: '12x17.1,450,2',
        lamination: 'none',
        checkedBox: null,
        gummingWidth: 12,
        gummingHeight: 1,
        numGummingStrips: 3,
        customerName: '',
        ratePerKg: 78,

    });
    const [calculationResult, setCalculationResult] = useState([]);
    const [error, setError] = useState('');
    const [gsmConstraints, setGsmConstraints] = useState({ min: 60, max: 180 });
    const [serial, setSerial] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const [adjustmentPercentage, setAdjustmentPercentage] = useState(0);
    const [adjustmentAmount, setAdjustmentAmount] = useState(0);
    const sizeRef = useRef(null);
    const laminationRef = useRef(null);

    const posterDefaultGummingWidths = {
        'A4': 8.5, 'letter': 8.5, '12x17.1': 12, '11x17': 11,
        '14x19': 14, '17.1x24': 17.1, '19x29': 19, '17x22.5': 17
    };

    const fullSizeSheetMapping = {
        'A4': '18x25', 'letter': '18x23', '12x17.1': '18x25', '11x17': '18x23',
        '14x19': '20x30', '17.1x24': '18x25', '19x29': '20x30', '17x22.5': '18x23'
    };

    const hotmailStickerSheets = [
        { w: 18, h: 25, price: 7.5 }, { w: 18, h: 23, price: 7 }, { w: 15, h: 20, price: 5 }, { w: 20, h: 30, price: 10 }
    ];

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setInputs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    useEffect(() => {
        const sizeName = inputs.posterSize.split(',')[0];
        setInputs(prev => ({ ...prev, gummingWidth: posterDefaultGummingWidths[sizeName] || 0 }));
    }, [inputs.posterSize]);

    useEffect(() => {
        let newConstraints = { min: '', max: '' };
        let newGsm = inputs.gsm;

        if (inputs.paperType === 'hotmail') {
            // No GSM for hotmail sticker
        } else if (inputs.paperType === '76') {
            newConstraints = { min: 50, max: 130 };
            if (inputs.gsm < 50 || inputs.gsm > 130) newGsm = 80;
        } else if (inputs.paperType === '78' && inputs.paperTypeText === 'Art Paper') {
            newConstraints = { min: 60, max: 180 };
            if (inputs.gsm < 60 || inputs.gsm > 180) newGsm = 90;
        } else if (inputs.paperType === '78' && inputs.paperTypeText === 'Art Card') {
            newConstraints = { min: 180, max: 401 };
            if (inputs.gsm < 180 || inputs.gsm > 401) newGsm = 250;
        }
        setGsmConstraints(newConstraints);
        setInputs(prev => ({ ...prev, gsm: newGsm }));
    }, [inputs.paperType, inputs.paperTypeText]);

    useEffect(() => {
      if (formData) {
        setInputs(formData.inputs || {
            quantity: 1000, paperType: '78', paperTypeText: 'Art Paper', gsm: 90,
            posterSize: '12x17.1,450,2', lamination: 'none', checkedBox: null,
            gummingWidth: 12, gummingHeight: 1, numGummingStrips: 3,
            customerName: '', ratePerKg: 78,
        });
        setSerial(formData.serial || null);
        setCalculationResult(formData.results || []);
      }
    }, [formData]);

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


    const handleCheckboxChange = (id) => {
        setInputs(prev => ({ ...prev, checkedBox: prev.checkedBox === id ? null : id }));
    };
    
    const getPosterDimensions = (sizeName) => {
        if (sizeName.toLowerCase() === 'a4') return { pw: 8.27, ph: 11.69 };
        if (sizeName.toLowerCase() === 'letter') return { pw: 8.5, ph: 11 };
        const match = sizeName.match(/^([\d.]+)x([\d.]+)/);
        if (!match) return { pw: 0, ph: 0 };
        return { pw: parseFloat(match[1]), ph: parseFloat(match[2]) };
    };

    const getMaxFitPerSheet = (sheetW, sheetH, posterW, posterH) => {
        const fit1 = Math.floor(sheetW / posterW) * Math.floor(sheetH / posterH);
        const fit2 = Math.floor(sheetW / posterH) * Math.floor(sheetH / posterW);
        return Math.max(fit1, fit2);
    };

    const calculateRate = () => {
        setError('');
        if (!inputs.customerName) {
            setError('Please select a customer before calculating.');
            return;
        }
        
        // GSM validation
        const selectedPaper = paperTypes.find(p => p.paperTypeName === inputs.paperType);
        const gsmValue = parseInt(inputs.gsm);
        if (selectedPaper && selectedPaper.minGsm && selectedPaper.maxGsm && inputs.paperType !== 'hotmail') {
            if (gsmValue < selectedPaper.minGsm || gsmValue > selectedPaper.maxGsm) {
                setError(`GSM must be between ${selectedPaper.minGsm} and ${selectedPaper.maxGsm} for ${selectedPaper.paperTypeName}`);
                return;
            }
        }
        
        // Do not clear previous results, allow appending
        const { quantity, paperType, gsm, paperTypeText, posterSize, lamination, checkedBox, gummingWidth, gummingHeight, numGummingStrips, ratePerKg } = inputs;

        const qty = Number(quantity);
        if (isNaN(qty) || qty <= 0) {
            setError('Please enter a valid Quantity.');
            return;
        }

        const useHotmailSticker = paperType === 'hotmail';
        if (!useHotmailSticker) {
            const currentGsm = Number(gsm);
            if (isNaN(currentGsm) || currentGsm <= 0) {
                setError('Please enter a valid GSM.');
                return;
            }
            if ((gsmConstraints.min && currentGsm < gsmConstraints.min) || (gsmConstraints.max && currentGsm > gsmConstraints.max)) {
                setError(`GSM for ${paperTypeText} must be between ${gsmConstraints.min} and ${gsmConstraints.max}.`);
                return;
            }
        }
        
        if (isNaN(gummingWidth) || gummingWidth < 0 || isNaN(gummingHeight) || gummingHeight < 0 || isNaN(numGummingStrips) || numGummingStrips < 0) {
            setError('Please enter valid Gumming Strip details.');
            return;
        }

        let paperRate = 0;
        let paperCostBreakdown = '';
        let laminationCost = 0;
        let totalSheetsNeededForPaper = 0;
        let paperTypeRate = parseFloat(ratePerKg);
        let bestFit = { fit: 0, sheet: null, neededSheets: 0, fitPerSheet: 0, wastageSheets: 0 };

        if (checkedBox === 'A') paperTypeRate -= 3;
        if (checkedBox === 'B') paperTypeRate -= 2;

        const sizeParts = posterSize.split(',');
        const selectedSizeName = sizeParts[0];
        const sizeBaseValue = parseFloat(sizeParts[1]);
        const sizeUps = parseInt(sizeParts[2], 10);

        if (useHotmailSticker) {
            const { pw: posterW, ph: posterH } = getPosterDimensions(selectedSizeName);
            
            hotmailStickerSheets.forEach(sheet => {
                const fitPerSheet = getMaxFitPerSheet(sheet.w, sheet.h, posterW, posterH);
                if (fitPerSheet > 0) {
                    const baseSheets = Math.ceil(qty / fitPerSheet);
                    let wastageSheets = 0;
                    if (baseSheets < 2000) wastageSheets = 100;
                    else if (baseSheets <= 3500) wastageSheets = 150;
                    else if (baseSheets <= 5000) wastageSheets = 250;
                    else wastageSheets = Math.ceil(baseSheets * 0.03);
                    const neededSheets = baseSheets + wastageSheets;

                    if (fitPerSheet > bestFit.fit || (fitPerSheet === bestFit.fit && sheet.price < (bestFit.sheet ? bestFit.sheet.price : Infinity))) {
                        bestFit = { fit: fitPerSheet, sheet, neededSheets, fitPerSheet, wastageSheets };
                    }
                }
            });

            if (!bestFit.sheet) {
                paperRate = 0;
                paperCostBreakdown = `Poster size (${selectedSizeName}) does not fit any Hotmail sticker sheet size.`;
            } else {
                totalSheetsNeededForPaper = bestFit.neededSheets;
                paperRate = totalSheetsNeededForPaper * bestFit.sheet.price;
                paperCostBreakdown = `Used Hotmail sticker sheet: ${bestFit.sheet.w}x${bestFit.sheet.h}" at ₹${bestFit.sheet.price}/sheet, ${bestFit.fitPerSheet} posters per sheet. Total sheets (including wastage of ${bestFit.wastageSheets}): ${totalSheetsNeededForPaper}.`;
                
                let laminationRatePerSqInch = 0;
                if (lamination === 'matt_lam') laminationRatePerSqInch = 0.45;
                else if (lamination === 'gloss_lam') laminationRatePerSqInch = 0.42;
                else if (lamination === 'varnish_os') laminationRatePerSqInch = 0.25;
                
                laminationCost = bestFit.sheet.w * bestFit.sheet.h * laminationRatePerSqInch * totalSheetsNeededForPaper / 100;
            }
        } else {
            const sheetsPerJob = qty / sizeUps;
            let wastageSheets = 0;
            if (sheetsPerJob < 2000) wastageSheets = 100;
            else if (sheetsPerJob <= 3500) wastageSheets = 150;
            else if (sheetsPerJob <= 5000) wastageSheets = 250;
            else wastageSheets = Math.ceil(sheetsPerJob * 0.03);
            
            totalSheetsNeededForPaper = sheetsPerJob + wastageSheets;
            paperRate = sizeBaseValue * (gsm / 3100) * (ratePerKg / 500) * totalSheetsNeededForPaper;
            paperCostBreakdown = `Paper rate per kg: ₹${ratePerKg}. Total sheets (including wastage of ${wastageSheets}): ${Math.ceil(totalSheetsNeededForPaper)}.`;

            let laminationRatePerSqInch = 0;
            if (lamination === 'matt_lam') laminationRatePerSqInch = 0.45;
            else if (lamination === 'gloss_lam') laminationRatePerSqInch = 0.42;
            else if (lamination === 'varnish_os') laminationRatePerSqInch = 0.25;

            laminationCost = sizeBaseValue * laminationRatePerSqInch * totalSheetsNeededForPaper / 100;
        }
        
        let baseCost = 1600, largeBaseCost = 2200;
        let impressionCost = 400, largeImpressionCost = 500;

        if (checkedBox === 'A') { baseCost = 1250; largeBaseCost = 1250; }
        else if (checkedBox === 'B') { baseCost = 1350; largeBaseCost = 1350; impressionCost = 360; largeImpressionCost = 360; }
        else if (checkedBox === 'C') { baseCost = 1700; largeBaseCost = 1700; }
        
        const effectiveSheetsForPrinting = qty / sizeUps;
        const smallSizes = ['A4', '12x17.1', 'letter', '11x17', '17x22.5'];
        let printingCost = 0;
        if (smallSizes.includes(selectedSizeName)) {
            printingCost = Math.ceil(effectiveSheetsForPrinting / 1000) * impressionCost + baseCost;
        } else {
            printingCost = Math.ceil(effectiveSheetsForPrinting / 1000) * largeImpressionCost + largeBaseCost;
        }
        
        let gummingStripCost = 0;
        if (!useHotmailSticker && gummingWidth > 0 && gummingHeight > 0 && numGummingStrips > 0) {
            const areaBasedCost = (gummingWidth * gummingHeight * numGummingStrips) * 1.5 * qty / 100;
            const quantityBasedMinimum = Math.ceil(qty / 1000) * 450;
            gummingStripCost = Math.max(areaBasedCost, quantityBasedMinimum);
        }

        const totalAmount = paperRate + printingCost + laminationCost + gummingStripCost;
        let ratePerPiece = (qty > 0) ? totalAmount / qty : 0;
        
        let ratePerPieceText = ratePerPiece.toFixed(2);
        if (checkedBox === 'A') ratePerPieceText += '.';
        if (checkedBox === 'B') ratePerPieceText += '..';

        const selectedSizeText = sizeRef.current ? sizeRef.current.options[sizeRef.current.selectedIndex].text : '';
        const selectedLaminationText = laminationRef.current ? laminationRef.current.options[laminationRef.current.selectedIndex].text : '';

        const resultObj = {
            quantity: qty,
            gsm: useHotmailSticker ? 'N/A' : gsm,
            paperTypeText,
            selectedSizeText,
            gummingWidth,
            gummingHeight,
            numGummingStrips,
            useHotmailSticker,
            selectedLaminationText,
            totalAmount: totalAmount.toFixed(2),
            ratePerPiece: ratePerPieceText,
            paperCost: paperRate.toFixed(2),
            paperCostBreakdown,
            printingCost: printingCost.toFixed(2),
            laminationCost: laminationCost.toFixed(2),
            gummingStripCost: gummingStripCost.toFixed(2),
            totalSheetsRequired: Math.ceil(totalSheetsNeededForPaper),
            fullSizePaper: useHotmailSticker && bestFit.sheet ? `${bestFit.sheet.w}" x ${bestFit.sheet.h}"` : fullSizeSheetMapping[selectedSizeName] || selectedSizeName,
            ups: useHotmailSticker && bestFit.fitPerSheet ? bestFit.fitPerSheet : sizeUps,
        };

        setCalculationResult(prevResult => {
            setHasUnsavedChanges(true);
            return [...prevResult, resultObj];
        });
        if (!serial) setSerial(getNextSerial());
    };

    const handleSave = () => {
        if (calculationResult.length === 0) {
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
            productType: 'Poster',
            serial: formData && formData.serial ? formData.serial : getNextSerial(),
            customerName: inputs.customerName,
            inputs: inputs,
            results: calculationResult,
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
        const newResults = calculationResult.filter((_, i) => i !== index);
        if (newResults.length === 0) {
            setHasUnsavedChanges(false);
        }
        setCalculationResult(newResults);
    };

    const handleAdjustment = (direction) => {
        const percentage = parseFloat(adjustmentPercentage) || 0;
        if (percentage === 0) return;
        const multiplier = direction === 'add' ? (1 + percentage / 100) : (1 - percentage / 100);
        setCalculationResult(prevResult => prevResult.map(r => {
            const newTotalAmount = parseFloat(r.totalAmount) * multiplier;
            const newRatePerPiece = newTotalAmount / r.quantity;
            return { ...r, totalAmount: newTotalAmount.toFixed(2), ratePerPiece: newRatePerPiece.toFixed(2) };
        }));
    };

    const handleAmountAdjustment = (direction) => {
        const amount = parseFloat(adjustmentAmount) || 0;
        if (amount === 0) return;
        const adjustment = direction === 'add' ? amount : -amount;
        setCalculationResult(prevResult => prevResult.map(r => {
            const newTotalAmount = parseFloat(r.totalAmount) + adjustment;
            const newRatePerPiece = newTotalAmount / r.quantity;
            return { ...r, totalAmount: newTotalAmount.toFixed(2), ratePerPiece: newRatePerPiece.toFixed(2) };
        }));
    };


    return (
        <div className={`cuttosheet-flex-container ${calculationResult.length > 0 ? 'results-visible' : ''}`}>
            <div className="cuttosheet-box cuttosheet-form-box">
                <h1 className="form-title-pink">Poster Quotation</h1>
                <form className="cut-to-sheet-form" onSubmit={e => e.preventDefault()}>
                    <div className="form-grid-modern">
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                            <div style={{ flexGrow: 1 }}>
                                <label className="input-label" htmlFor="customerName">Customer Name</label>
                                <select id="customerName" name="customerName" className="input-box" value={inputs.customerName} onChange={handleInputChange} required>
                                    <option value="">-- Select Customer --</option>
                                    {customers.map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
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
                            <label className="input-label" htmlFor="quantity">Quantity (Qty)</label>
                            <input type="number" id="quantity" name="quantity" className="input-box" value={inputs.quantity} onChange={handleInputChange} min="1" placeholder="Enter quantity" />
                        </div>
                        <div className="form-group">
                            <label className="input-label" htmlFor="paperType">Paper Type</label>
                            <select id="paperType" name="paperType" className="input-box" value={inputs.paperType} onChange={(e) => {
                                const selectedPaperType = paperTypes.find(p => p.paperTypeName === e.target.value);
                                if (selectedPaperType) {
                                    setInputs(prev => ({
                                        ...prev,
                                        paperType: selectedPaperType.paperTypeName,
                                        ratePerKg: selectedPaperType.ratePerKg,
                                    }));
                                } else {
                                    setInputs(prev => ({ ...prev, paperType: e.target.value }));
                                }
                            }}>
                                <option value="">-- Select --</option>
                                {paperTypes.map(p => <option key={p.id} value={p.paperTypeName}>{p.paperTypeName}</option>)}
                            </select>
                        </div>
                        {inputs.paperType !== 'hotmail' && (
                            <>
                                <div className="form-group">
                                    <label className="input-label" htmlFor="gsm" title="Grams Per Square Meter">GSM</label>
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
                                    }} placeholder="Enter GSM" />
                                </div>
                                <div className="form-group">
                                    <label className="input-label" htmlFor="ratePerKg">Rate per Kg</label>
                                    <input type="number" id="ratePerKg" name="ratePerKg" className="input-box" value={inputs.ratePerKg} onChange={handleInputChange} min="0" step="0.01" />
                                </div>
                            </>
                        )}
                        <div className="form-group">
                            <label className="input-label" htmlFor="posterSize">Poster Size</label>
                            <select id="posterSize" name="posterSize" ref={sizeRef} className="input-box" value={inputs.posterSize} onChange={handleInputChange}>
                                <option value="A4,450,4">A4 (210 x 297 mm)</option>
                                <option value="12x17.1,450,2">12 x 17.1 inches</option>
                                <option value="14x19,600,2">14 x 19 inches</option>
                                <option value="19x29,600,1">19 x 29 inches</option>
                                <option value="17.1x24,450,1">17.1 x 24 inches</option>
                                <option value="letter,414,4">Letter (216 x 279 mm)</option>
                                <option value="11x17,414,2">11 x 17 inches</option>
                                <option value="17x22.5,414,1">17 x 22.5 inches</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="input-label" htmlFor="lamination">Lamination Type</label>
                            <select id="lamination" name="lamination" ref={laminationRef} className="input-box" value={inputs.lamination} onChange={handleInputChange}>
                                <option value="none">None</option>
                                <option value="matt_lam">Matt Lam</option>
                                <option value="gloss_lam">Gloss Lam</option>
                                <option value="varnish_os">Varnish OS</option>
                            </select>
                        </div>
                        <div className="abc-checkboxes-modern" style={{gridColumn: '1 / -1'}}>
                            <label className="modern-toggle-label"><input type="checkbox" className="modern-toggle" checked={inputs.checkedBox === 'A'} onChange={() => handleCheckboxChange('A')} /><span>Nagesh</span></label>
                            <label className="modern-toggle-label"><input type="checkbox" className="modern-toggle" checked={inputs.checkedBox === 'B'} onChange={() => handleCheckboxChange('B')} /><span>long qty</span></label>
                            <label className="modern-toggle-label"><input type="checkbox" className="modern-toggle" checked={inputs.checkedBox === 'C'} onChange={() => handleCheckboxChange('C')} /><span>Short qty</span></label>
                        </div>
                    </div>
                    {inputs.paperType !== 'hotmail' && (
                        <div className="form-grid-modern" style={{ marginTop: '1rem' }}>
                            <div className="form-group">
                                <label className="input-label" htmlFor="gummingWidth">Gumming Width (inch)</label>
                                <input type="number" id="gummingWidth" name="gummingWidth" className="input-box" value={inputs.gummingWidth} onChange={handleInputChange} min="0" step="0.1" />
                            </div>
                            <div className="form-group">
                                <label className="input-label" htmlFor="gummingHeight">Gumming Height (inch)</label>
                                <input type="number" id="gummingHeight" name="gummingHeight" className="input-box" value={inputs.gummingHeight} onChange={handleInputChange} min="0" step="0.1" />
                            </div>
                            <div className="form-group">
                                <label className="input-label" htmlFor="numGummingStrips">No. of Strips</label>
                                <input type="number" id="numGummingStrips" name="numGummingStrips" className="input-box" value={inputs.numGummingStrips} onChange={handleInputChange} min="0" />
                            </div>
                        </div>
                    )}
                    <div className="center-align-container">
                        <button type="button" className="save-btn-modern" onClick={calculateRate}>Calculate</button>
                    </div>
                </form>
                <Modal show={!!error} onClose={() => setError('')}>
                    <p className="text-lg text-red-600">{error}</p>
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
            {calculationResult.length > 0 && (
                <div className="cuttosheet-box cuttosheet-result-box">
                    <h3 className="form-title-pink">Quotation Details</h3>
                    <div className="overflow-x-auto mb-4">
                        <table className="result-table-modern compact-table">
                            <thead>
                                <tr>
                                    <th>Quotation - {formData && formData.serial ? formData.serial : getNextSerial()}</th>
                                    {calculationResult.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Quantity</td>
                                    {calculationResult.map((r, i) => <td key={i}>{r.quantity}</td>)}
                                </tr>
                                <tr>
                                    <td>Size</td>
                                    {calculationResult.map((r, i) => <td key={i}>{r.selectedSizeText}</td>)}
                                </tr>
                                {calculationResult[0].gsm !== 'N/A' && (
                                    <tr>
                                        <td>GSM</td>
                                        {calculationResult.map((r, i) => <td key={i}>{r.gsm} GSM</td>)}
                                    </tr>
                                )}
                                <tr>
                                    <td>Paper Type</td>
                                    {calculationResult.map((r, i) => <td key={i}>{capitalizeFirstLetter(r.paperTypeText)}</td>)}
                                </tr>
                                <tr>
                                    <td>Lamination</td>
                                    {calculationResult.map((r, i) => <td key={i}>{capitalizeFirstLetter(r.selectedLaminationText)}</td>)}
                                </tr>
                                {!calculationResult[0].useHotmailSticker && (calculationResult[0].gummingWidth > 0 || calculationResult[0].gummingHeight > 0 || calculationResult[0].numGummingStrips > 0) && (
                                    <tr>
                                        <td>Gumming Strips</td>
                                        {calculationResult.map((r, i) => <td key={i}>{`W: ${r.gummingWidth}", H: ${r.gummingHeight}", #: ${r.numGummingStrips}`}</td>)}
                                    </tr>
                                )}
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
                                {calculationResult.map((r, i) => (
                                    <tr key={i}>
                                        <td>Option {i + 1}</td>
                                        <td>₹{r.totalAmount}</td>
                                        <td>₹{r.ratePerPiece}</td>
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

                    <div className="mt-4 flex gap-4 justify-center">
                        <button type="button" className="save-btn-modern" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : (serial ? 'Update Quotation' : 'Save Quotation')}
                        </button>
                        {hasUnsavedChanges && (
                            <p style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '10px', textAlign: 'center' }}>
                                * You have unsaved changes
                            </p>
                        )}
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
                    <div className="overflow-x-auto mb-4">
                        <h4 className="text-lg font-semibold mb-3 text-gray-700">Paper Requirements</h4>
                        <table className="result-table-modern compact-table">
                            <thead>
                                <tr>
                                    <th>Details</th>
                                    {calculationResult.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>No of Sheet</td>
                                    {calculationResult.map((r, i) => <td key={i}>{r.totalSheetsRequired || 'N/A'} sheets</td>)}
                                </tr>
                                <tr>
                                    <td>Sheet Size</td>
                                    {calculationResult.map((r, i) => <td key={i}>{r.fullSizePaper || 'N/A'}</td>)}
                                </tr>
                                <tr>
                                    <td>UPS</td>
                                    {calculationResult.map((r, i) => <td key={i}>{r.ups || 'N/A'}</td>)}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="overflow-x-auto mb-4">
                        <h4 className="text-lg font-semibold mb-3 text-gray-700">Cost Breakdown</h4>
                        <table className="result-table-modern compact-table">
                            <thead>
                                <tr>
                                    <th>Cost Type</th>
                                    {calculationResult.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Paper Cost</td>
                                    {calculationResult.map((r, i) => <td key={i}>₹{r.paperCost}</td>)}
                                </tr>
                                <tr>
                                    <td>Printing Cost</td>
                                    {calculationResult.map((r, i) => <td key={i}>₹{r.printingCost}</td>)}
                                </tr>
                                <tr>
                                    <td>Lamination Cost</td>
                                    {calculationResult.map((r, i) => <td key={i}>₹{r.laminationCost}</td>)}
                                </tr>
                                <tr>
                                    <td>Gumming Strip Cost</td>
                                    {calculationResult.map((r, i) => <td key={i}>₹{r.gummingStripCost}</td>)}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>
            )}
        </div>
    );
}

export default Poster;
