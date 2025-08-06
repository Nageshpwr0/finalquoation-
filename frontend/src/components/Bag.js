import React, { useState, useEffect } from 'react';
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

const Bag = ({ formData, onSaved, getNextSerial, customers, paperTypes = [], onAddNewCustomer, apiUrl, onNavigate }) => {
    const [inputs, setInputs] = useState({
        width: '',
        height: '',
        spine: '',
        gsm: '',
        lamination: '',
        paperCostPerKg: '',
        quantity: '',
        customerName: '',
    });
    const [result, setResult] = useState([]);
    const [error, setError] = useState('');
    const [serial, setSerial] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState('');
    const [adjustmentPercentage, setAdjustmentPercentage] = useState(0);
    const [adjustmentAmount, setAdjustmentAmount] = useState(0);

    useEffect(() => {
      if (formData) {
        setInputs(formData.inputs || {
            width: '',
            height: '',
            spine: '',
            gsm: '',
            lamination: '',
            paperCostPerKg: '',
            quantity: '',
            customerName: '',
        });
        setSerial(formData.serial || null);
        setResult(formData.results || []);
      }
    }, [formData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputs(prev => ({ ...prev, [name]: value }));
    };

    const getWastageSheets = (quantity) => {
        if (quantity <= 1550) return 100;
        if (quantity <= 2500) return 150;
        if (quantity <= 4000) return 200;
        if (quantity <= 6000) return 300;
        if (quantity <= 9000) return 350;
        if (quantity <= 15000) return 400;
        return Math.ceil(quantity * 0.03);
    };

    const calculateBag = () => {
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
        const parsedWidth = parseFloat(inputs.width);
        const parsedHeight = parseFloat(inputs.height);
        const parsedSpine = parseFloat(inputs.spine);
        const parsedGsm = parseFloat(inputs.gsm);
        const parsedPaperCostPerKg = parseFloat(inputs.paperCostPerKg);
        const parsedQuantity = parseInt(inputs.quantity);

        // Do not clear previous results, allow appending
        setError('');

        if (isNaN(parsedWidth) || isNaN(parsedHeight) || isNaN(parsedSpine) || parsedWidth <= 0 || parsedHeight <= 0 || parsedSpine < 0) {
            setError("Please enter valid positive numeric values for Width and Height, and non-negative for Spine.");
            return;
        }
        if (isNaN(parsedGsm) || parsedGsm <= 0) {
            setError("Please enter a valid positive numeric value for GSM.");
            return;
        }
        if (isNaN(parsedPaperCostPerKg) || parsedPaperCostPerKg <= 0) {
            setError("Please enter a valid positive numeric value for Paper Cost/Kg.");
            return;
        }
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            setError("Please enter a valid positive numeric value for Quantity.");
            return;
        }

        const MM_TO_INCH = 25.4;
        const GRIPPER_MM = 10; // Changed from 19 to 10
        const TRIM_MM = 2;
        const gripperSideLossInches = GRIPPER_MM / MM_TO_INCH; // Now dynamically calculated
        const otherDimensionLossInches = (TRIM_MM + TRIM_MM) / MM_TO_INCH;
        const finalHeight = parsedHeight + (parsedSpine * 0.75) + 1.25;
        const availablePapers = [
            [15, 20], [18, 23], [19, 25], [20, 30],
            [12, 23], [12, 25], [15, 25], [18, 25], [14, 26]
        ];

        let bestFitPaper = null;
        let bestFitPaperPhysicalDimensions = [];
        let maxPiecesPerSheetOverall = 0;
        let minWastagePerSheet = Infinity;
        let finalWidthAdjustmentUsed = 0.75;

        availablePapers.forEach(paper => {
            const p1 = paper[0];
            const p2 = paper[1];
            const effectivePaperOptions = [];

            let effectiveP1_option1, effectiveP2_option1;
            if (p1 <= p2) {
                effectiveP1_option1 = p1 - gripperSideLossInches;
                effectiveP2_option1 = p2 - otherDimensionLossInches;
            } else {
                effectiveP1_option1 = p1 - otherDimensionLossInches;
                effectiveP2_option1 = p2 - gripperSideLossInches;
            }
            effectivePaperOptions.push([effectiveP1_option1, effectiveP2_option1, `${p1}x${p2}`, p1, p2]);

            let effectiveP2_option2, effectiveP1_option2;
            if (p2 <= p1) {
                effectiveP2_option2 = p2 - gripperSideLossInches;
                effectiveP1_option2 = p1 - otherDimensionLossInches;
            } else {
                effectiveP2_option2 = p2 - otherDimensionLossInches;
                effectiveP1_option2 = p1 - gripperSideLossInches;
            }
            effectivePaperOptions.push([effectiveP2_option2, effectiveP1_option2, `${p2}x${p1}`, p2, p1]);

            effectivePaperOptions.forEach(effectivePaper => {
                const currentEffectiveWidth = effectivePaper[0];
                const currentEffectiveHeight = effectivePaper[1];
                const currentPaperName = effectivePaper[2];
                const currentPhysicalWidth = effectivePaper[3];
                const currentPhysicalHeight = effectivePaper[4];

                if (currentEffectiveWidth <= 0 || currentEffectiveHeight <= 0) return;

                const tempFinalWidth075 = parsedWidth + parsedSpine + 0.75;
                let currentPiecesFit1_075 = 0;
                if (tempFinalWidth075 <= currentEffectiveWidth && finalHeight <= currentEffectiveHeight) {
                    currentPiecesFit1_075 = Math.floor(currentEffectiveWidth / tempFinalWidth075) * Math.floor(currentEffectiveHeight / finalHeight);
                }
                let currentPiecesFit2_075 = 0;
                if (finalHeight <= currentEffectiveWidth && tempFinalWidth075 <= currentEffectiveHeight) {
                    currentPiecesFit2_075 = Math.floor(currentEffectiveWidth / finalHeight) * Math.floor(currentEffectiveHeight / tempFinalWidth075);
                }
                const maxCurrentPieces075 = Math.max(currentPiecesFit1_075, currentPiecesFit2_075);
                let wastage075 = Infinity;
                if (maxCurrentPieces075 > 0) {
                    wastage075 = (currentPhysicalWidth * currentPhysicalHeight) - (tempFinalWidth075 * finalHeight * maxCurrentPieces075);
                }

                const tempFinalWidth040 = parsedWidth + parsedSpine + 0.40;
                let currentPiecesFit1_040 = 0;
                if (tempFinalWidth040 <= currentEffectiveWidth && finalHeight <= currentEffectiveHeight) {
                    currentPiecesFit1_040 = Math.floor(currentEffectiveWidth / tempFinalWidth040) * Math.floor(currentEffectiveHeight / finalHeight);
                }
                let currentPiecesFit2_040 = 0;
                if (finalHeight <= currentEffectiveWidth && tempFinalWidth040 <= currentEffectiveHeight) {
                    currentPiecesFit2_040 = Math.floor(currentEffectiveWidth / finalHeight) * Math.floor(currentEffectiveHeight / tempFinalWidth040);
                }
                const maxCurrentPieces040 = Math.max(currentPiecesFit1_040, currentPiecesFit2_040);
                let wastage040 = Infinity;
                if (maxCurrentPieces040 > 0) {
                    wastage040 = (currentPhysicalWidth * currentPhysicalHeight) - (tempFinalWidth040 * finalHeight * maxCurrentPieces040);
                }

                let currentChosenPieces = 0;
                let currentChosenWastage = Infinity;
                let currentChosenWidthAdjustment = 0.75;
                if (maxCurrentPieces040 > 0 && maxCurrentPieces040 % 2 === 0) {
                    currentChosenPieces = maxCurrentPieces040;
                    currentChosenWastage = wastage040;
                    currentChosenWidthAdjustment = 0.40;
                    if (maxCurrentPieces075 > 0 && maxCurrentPieces075 % 2 === 0) {
                        if (maxCurrentPieces075 > currentChosenPieces ||
                            (maxCurrentPieces075 === currentChosenPieces && wastage075 < currentChosenWastage)) {
                            currentChosenPieces = maxCurrentPieces075;
                            currentChosenWastage = wastage075;
                            currentChosenWidthAdjustment = 0.75;
                        }
                    }
                } else if (maxCurrentPieces075 > 0) {
                    currentChosenPieces = maxCurrentPieces075;
                    currentChosenWastage = wastage075;
                    currentChosenWidthAdjustment = 0.75;
                    if (maxCurrentPieces040 > 0) {
                        if (maxCurrentPieces040 > currentChosenPieces ||
                            (maxCurrentPieces040 === currentChosenPieces && wastage040 < currentChosenWastage)) {
                            currentChosenPieces = maxCurrentPieces040;
                            currentChosenWastage = wastage040;
                            currentChosenWidthAdjustment = 0.40;
                        }
                    }
                }
                if (currentChosenPieces > maxPiecesPerSheetOverall) {
                    maxPiecesPerSheetOverall = currentChosenPieces;
                    bestFitPaper = currentPaperName;
                    bestFitPaperPhysicalDimensions = [currentPhysicalWidth, currentPhysicalHeight];
                    minWastagePerSheet = currentChosenWastage;
                    finalWidthAdjustmentUsed = currentChosenWidthAdjustment;
                } else if (currentChosenPieces === maxPiecesPerSheetOverall && currentChosenPieces > 0) {
                    if (currentChosenWastage < minWastagePerSheet) {
                        minWastagePerSheet = currentChosenWastage;
                        bestFitPaper = currentPaperName;
                        bestFitPaperPhysicalDimensions = [currentPhysicalWidth, currentPhysicalHeight];
                        finalWidthAdjustmentUsed = currentChosenWidthAdjustment;
                    }
                    else if (currentChosenWastage === minWastagePerSheet &&
                             currentChosenWidthAdjustment === 0.40 && (currentChosenPieces % 2 === 0)) {
                        minWastagePerSheet = currentChosenWastage;
                        bestFitPaper = currentPaperName;
                        bestFitPaperPhysicalDimensions = [currentPhysicalWidth, currentPhysicalHeight];
                        finalWidthAdjustmentUsed = currentChosenWidthAdjustment;
                    }
                }
            });
        });

        if (bestFitPaper && maxPiecesPerSheetOverall > 0) {
            const actualPaperWidth = bestFitPaperPhysicalDimensions[0];
            const actualPaperHeight = bestFitPaperPhysicalDimensions[1];
            const wastageSheets = getWastageSheets(parsedQuantity);
            const fullSheetWidth = actualPaperWidth;
            const fullSheetHeight = actualPaperHeight;

            let totalLaminationCost = 0;
            let laminationDetails = "";
            const totalSheetsForLamination = (parsedQuantity + wastageSheets) / maxPiecesPerSheetOverall;
            if (inputs.lamination) {
                let laminationFactor = 0;
                switch (inputs.lamination) {
                    case 'matt': laminationFactor = 0.45; laminationDetails = "Matt Lamination"; break;
                    case 'gloss': laminationFactor = 0.42; laminationDetails = "Gloss Lamination"; break;
                    case 'varnish': laminationFactor = 0.25; laminationDetails = "Varnish"; break;
                    case 'thermal': laminationFactor = 0.85; laminationDetails = "Thermal Lamination"; break;
                    case 'velvet': laminationFactor = 3; laminationDetails = "Velvet Lamination"; break;
                    default: laminationFactor = 0; laminationDetails = "None/Invalid";
                }
                totalLaminationCost = fullSheetWidth * fullSheetHeight * laminationFactor * totalSheetsForLamination * 2 / 100;
            } else {
                laminationDetails = "None";
            }

            let dieCost = 0;
            const paperArea = fullSheetWidth * fullSheetHeight;
            if (paperArea < 320) dieCost = 1500;
            else if (paperArea <= 450) dieCost = 2000;
            else if (paperArea <= 550) dieCost = 2500;
            else dieCost = 3200;

            const panelTypes = [
                { label: "Both Side Same Panel", value: "same" },
                { label: "Both Side Different Panel", value: "different" }
            ];

            const resultsData = panelTypes.map(panel => {
                let totalPaperCost;
                if (maxPiecesPerSheetOverall === 1 && panel.value === 'same') {
                    totalPaperCost = (fullSheetWidth * fullSheetHeight * parsedGsm / 3100) * (parsedPaperCostPerKg / 500) * ((parsedQuantity * 2 + wastageSheets) / 1);
                } else {
                    totalPaperCost = (fullSheetWidth * fullSheetHeight * parsedGsm / 3100) * (parsedPaperCostPerKg / 500) * ((parsedQuantity + wastageSheets) * 2 / maxPiecesPerSheetOverall);
                }

                let totalPrintingCost = 0;
                let ratePerFactor = (bestFitPaper === '20x30' || bestFitPaper === '30x20') ? 500 : 400;
                let baseCost = (bestFitPaper === '20x30' || bestFitPaper === '30x20') ? 2000 : 1600;
                if (maxPiecesPerSheetOverall === 1) {
                    if (panel.value === 'different') {
                        totalPrintingCost = (Math.ceil(parsedQuantity / 1000) * ratePerFactor + baseCost) * 2;
                    } else if (panel.value === 'same') {
                        const factor = (parsedQuantity / 1000 * 2) / 1000;
                        totalPrintingCost = (Math.ceil(factor) * 2 * ratePerFactor + baseCost);
                    }
                } else {
                    if (bestFitPaper === '20x30' || bestFitPaper === '30x20') {
                        totalPrintingCost = Math.ceil(parsedQuantity / maxPiecesPerSheetOverall / 1000 * 2) * ratePerFactor + baseCost;
                    } else {
                        const factor = (parsedQuantity / maxPiecesPerSheetOverall * 2) / 1000;
                        totalPrintingCost = Math.ceil(factor) * ratePerFactor + baseCost;
                    }
                }

                const punchingCost = Math.ceil(parsedQuantity * 2 / maxPiecesPerSheetOverall / 1000) * 400;
                const makingCost = parsedQuantity * 5;
                const totalAmt = totalPaperCost + totalPrintingCost + totalLaminationCost + dieCost + punchingCost + makingCost;
                const finalRate = totalAmt / parsedQuantity;

                let totalSheets;
                if (maxPiecesPerSheetOverall === 1 && panel.value === 'same') {
                    totalSheets = (parsedQuantity * 2 + wastageSheets) / 1;
                } else {
                    totalSheets = (parsedQuantity + wastageSheets) * 2 / maxPiecesPerSheetOverall;
                }

                return {
                    panelLabel: panel.label,
                    quantity: parsedQuantity,
                    width: parsedWidth,
                    height: parsedHeight,
                    spine: parsedSpine,
                    gsm: parsedGsm,
                    lamination: inputs.lamination ? laminationDetails : 'None',
                    totalAmt: totalAmt.toFixed(2),
                    finalRate: finalRate.toFixed(2),
                    paperCost: totalPaperCost.toFixed(2),
                    printingCost: totalPrintingCost.toFixed(2),
                    laminationCost: totalLaminationCost.toFixed(2),
                    dieCost: dieCost.toFixed(2),
                    punchingCost: punchingCost.toFixed(2),
                    makingCost: makingCost.toFixed(2),
                    bestFitPaper: bestFitPaper,
                    totalSheets: Math.ceil(totalSheets),
                    ups: maxPiecesPerSheetOverall
                };
            });
            setResult(prevResult => [...prevResult, ...resultsData]);
        } else {
            const finalHeightValue = parsedHeight + (parsedSpine * 0.75) + 1.25;
            const finalWidthDefault = parsedWidth + parsedSpine + 0.75;
            setError(`Calculated Job Dimensions (Default): ${finalWidthDefault.toFixed(2)} x ${finalHeightValue.toFixed(2)} inches. No available full size paper can accommodate these dimensions.`);
        }
    };

    // Save/Update Quotation
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

        const quotationData = {
            productType: 'Bag',
            serial: formData && formData.serial ? formData.serial : getNextSerial(),
            customerName: inputs.customerName,
            inputs: inputs,
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
        setResult(result.filter((_, i) => i !== index));
    };

    const handleAdjustment = (direction) => {
        const percentage = parseFloat(adjustmentPercentage) || 0;
        if (percentage === 0) return;
        const multiplier = direction === 'add' ? (1 + percentage / 100) : (1 - percentage / 100);
        setResult(prevResult => prevResult.map(r => {
            const newTotalAmt = parseFloat(r.totalAmt) * multiplier;
            const newFinalRate = newTotalAmt / r.quantity;
            return { ...r, totalAmt: newTotalAmt.toFixed(2), finalRate: newFinalRate.toFixed(2) };
        }));
    };

    const handleAmountAdjustment = (direction) => {
        const amount = parseFloat(adjustmentAmount) || 0;
        if (amount === 0) return;
        const adjustment = direction === 'add' ? amount : -amount;
        setResult(prevResult => prevResult.map(r => {
            const newTotalAmt = parseFloat(r.totalAmt) + adjustment;
            const newFinalRate = newTotalAmt / r.quantity;
            return { ...r, totalAmt: newTotalAmt.toFixed(2), finalRate: newFinalRate.toFixed(2) };
        }));
    };

    return (
      <div className={`cuttosheet-flex-container ${result.length > 0 ? 'results-visible' : ''}`}>
        <div className="cuttosheet-box cuttosheet-form-box">
          <h1 className="form-title-pink">Bag Quotation</h1>
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
                <label className="input-label" htmlFor="paperType">Paper Type</label>
                <select id="paperType" name="paperType" className="input-box" value={inputs.paperType} onChange={(e) => {
                    const selectedPaperType = paperTypes.find(p => p.paperTypeName === e.target.value);
                    if (selectedPaperType) {
                        setInputs(prev => ({
                            ...prev,
                            paperType: selectedPaperType.paperTypeName,
                            paperCostPerKg: selectedPaperType.ratePerKg,
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
                <label className="input-label" htmlFor="width">Width</label>
                <input type="number" id="width" name="width" className="input-box" placeholder="Enter width" step="0.01" value={inputs.width} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label className="input-label" htmlFor="height">Height</label>
                <input type="number" id="height" name="height" className="input-box" placeholder="Enter height" step="0.01" value={inputs.height} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label className="input-label" htmlFor="spine">Spine</label>
                <input type="number" id="spine" name="spine" className="input-box" placeholder="Enter spine" step="0.01" value={inputs.spine} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label className="input-label" htmlFor="gsm">GSM</label>
                <input type="number" id="gsm" name="gsm" className="input-box" placeholder="Enter GSM" value={inputs.gsm} onChange={(e) => {
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
                }} />
              </div>
              <div className="form-group">
                <label className="input-label" htmlFor="lamination">Lamination</label>
                <select id="lamination" name="lamination" className="input-box" value={inputs.lamination} onChange={handleInputChange}>
                    <option value="">Select Lamination</option>
                    <option value="matt">Matt Lamination</option>
                    <option value="gloss">Gloss Lamination</option>
                    <option value="varnish">Varnish</option>
                    <option value="velvet">Velvet Lamination</option>
                    <option value="thermal">Thermal Lamination</option>
                </select>
              </div>
              <div className="form-group">
                <label className="input-label" htmlFor="paperCostPerKg">Paper Cost/Kg</label>
                <input type="number" id="paperCostPerKg" name="paperCostPerKg" className="input-box" placeholder="Enter Cost per Kg" step="0.01" value={inputs.paperCostPerKg} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label className="input-label" htmlFor="quantity">Quantity</label>
                <input type="number" id="quantity" name="quantity" className="input-box" placeholder="Enter quantity" step="1" value={inputs.quantity} onChange={handleInputChange} />
              </div>
            </div>
            <div className="center-align-container">
                <button type="button" className="save-btn-modern" onClick={calculateBag}>Calculate</button>
            </div>
          </form>
          <Modal show={!!error} onClose={() => setError('')}>
              <p className="text-lg text-red-600">{error}</p>
          </Modal>
        </div>
        {result.length > 0 && (
            <div className="cuttosheet-box cuttosheet-result-box">
                <h3 className="form-title-pink">Quotation Details</h3>
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
                                {result.map((r, i) => <td key={i}>{r.quantity}</td>)}
                            </tr>
                            <tr>
                                <td>Size</td>
                                {result.map((r, i) => <td key={i}>{`W: ${r.width}, H: ${r.height}, S: ${r.spine}`}</td>)}
                            </tr>
                            <tr>
                                <td>GSM</td>
                                {result.map((r, i) => <td key={i}>{r.gsm} GSM {inputs.paperType}</td>)}
                            </tr>
                            <tr>
                                <td>Paper Type</td>
                                {result.map((r, i) => <td key={i}>{inputs.paperType}</td>)}
                            </tr>
                            <tr>
                                <td>Lamination</td>
                                {result.map((r, i) => <td key={i}>{capitalizeFirstLetter(r.lamination)}</td>)}
                            </tr>
                            <tr>
                                <td>Panel Type</td>
                                {result.map((r, i) => <td key={i}>{r.panelLabel}</td>)}
                            </tr>
                            <tr>
                                <td style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>Total Amt</td>
                                {result.map((r, i) => <td key={i} style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>{r.totalAmt}</td>)}
                            </tr>
                            <tr>
                                <td style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>Rate</td>
                                {result.map((r, i) => <td key={i} style={{ backgroundColor: '#FFF9FB', fontWeight: '600', color: '#DB7093' }}>{r.finalRate}</td>)}
                            </tr>
                            <tr>
                                <td>Action</td>
                                {result.map((r, i) => <td key={i}><button onClick={() => handleDeleteResult(i)} className="delete-btn-modern">-</button></td>)}
                            </tr>
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
                    <button onClick={handleSave} className="save-btn-modern" disabled={isSaving}>
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

                <div className="overflow-x-auto mb-4">
                    <h4 className="text-lg font-semibold mb-3 text-gray-700">Cost Breakdown</h4>
                    <table className="result-table-modern compact-table">
                        <thead>
                            <tr>
                                <th>Cost Type</th>
                                {result.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Paper Cost</td>
                                {result.map((r, i) => <td key={i}>₹{r.paperCost}</td>)}
                            </tr>
                            <tr>
                                <td>Printing Cost</td>
                                {result.map((r, i) => <td key={i}>₹{r.printingCost}</td>)}
                            </tr>
                            <tr>
                                <td>Lamination Cost</td>
                                {result.map((r, i) => <td key={i}>₹{r.laminationCost}</td>)}
                            </tr>
                            <tr>
                                <td>Die Cost</td>
                                {result.map((r, i) => <td key={i}>₹{r.dieCost}</td>)}
                            </tr>
                            <tr>
                                <td>Punching Cost</td>
                                {result.map((r, i) => <td key={i}>₹{r.punchingCost}</td>)}
                            </tr>
                            <tr>
                                <td>Making Cost</td>
                                {result.map((r, i) => <td key={i}>₹{r.makingCost}</td>)}
                            </tr>
                        </tbody>
                    </table>
                </div>

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
                                <td>Paper Size</td>
                                {result.map((r, i) => <td key={i}>{r.bestFitPaper || 'N/A'}</td>)}
                            </tr>
                            <tr>
                                <td>No of Sheet</td>
                                {result.map((r, i) => <td key={i}>{r.totalSheets || 'N/A'}</td>)}
                            </tr>
                            <tr>
                                <td>UPS</td>
                                {result.map((r, i) => <td key={i}>{r.ups || 'N/A'}</td>)}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    );
};

export default Bag;
