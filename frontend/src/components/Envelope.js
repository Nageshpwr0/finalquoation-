import React, { useState, useEffect, useMemo } from 'react';
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

const Envelope = ({ formData, onSaved, getNextSerial, customers, paperTypes = [], laminationTypes = [], onAddNewCustomer, apiUrl, onNavigate }) => {
  const [inputs, setInputs] = useState({
    quantity: '',
    standardSize: '',
    envelopeType: 'kotak',
    width: '',
    height: '',
    gsm: '',
    paperType: 'Allabaster',
    makingType: 'punching',
    dieType: 'old',
    laminationType: 'none',
    addGummingFlap: false,
    addWindow: false,
    customerName: '',
    ratePerKg: '',

  });
  const [envelopeResult, setEnvelopeResult] = useState([]);
  const [serial, setSerial] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
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

  useEffect(() => {
    if (formData) {
      setInputs(formData.inputs || {
        quantity: '', standardSize: '', envelopeType: 'kotak', width: '', height: '', gsm: '',
        paperType: 'Allabaster', makingType: 'punching', dieType: 'old', laminationType: 'none',
        addGummingFlap: false, addWindow: false, customerName: '', ratePerKg: '',
      });
      setSerial(formData.serial || null);
      setEnvelopeResult(formData.results || []);
    }
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInputs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const envStandardSizes = {
    A4Center: { width: 12, height: 9.7, type: "centerPasting" },
    ChqKotak: { width: 9.25, height: 4.25, type: "kotak" },
    ChqRegular: { width: 9.25, height: 4.25, type: "centerPasting" },
    NineFiveKotak: { width: 9.5, height: 4.5, type: "kotak" },
    NineFiveCenter: { width: 9.5, height: 4.5, type: "centerPasting" }
  };

  const envPaperRates = {
    Allabaster: 80, Maplitho: 75, AGradeMaplitho: 76, BGrade: 66, Artpaper: 78, Artcard: 78, 'Natural Evalutiaon': 350, 'Arte/Xtella': 210, 'Montblank': 250
  };

  const envFullSheets = [
    { name: "18x25", w: 18, h: 25 }, { name: "18x23", w: 18, h: 23 }, { name: "15x20", w: 15, h: 20 },
    { name: "20x30", w: 20, h: 30 }, { name: "15x25", w: 15, h: 25 }, { name: "12x23", w: 12, h: 23 },
    { name: "12x25", w: 12, h: 25 }, { name: "19x25", w: 19, h: 25 }
  ];

  useEffect(() => {
    if (inputs.standardSize && envStandardSizes[inputs.standardSize]) {
      const { width, height, type } = envStandardSizes[inputs.standardSize];
      setInputs(prev => ({ ...prev, width, height, envelopeType: type }));
    }
  }, [inputs.standardSize]);

  useEffect(() => {
    if (inputs.paperType === 'Artcard' || inputs.paperType === 'Artpaper') {
      if (inputs.makingType === 'direct') {
        setInputs(prev => ({ ...prev, makingType: 'punching' }));
      }
    }
  }, [inputs.paperType, inputs.makingType]);

  useEffect(() => {
    if (envPaperRates[inputs.paperType]) {
      setInputs(prev => ({ ...prev, ratePerKg: envPaperRates[inputs.paperType] }));
    } else {
      setInputs(prev => ({ ...prev, ratePerKg: '' }));
    }
  }, [inputs.paperType]);


  const calculateEnvelopeCost = () => {
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
    const { width, height, gsm, quantity, ratePerKg, envelopeType, makingType, paperType, dieType, addGummingFlap, addWindow, laminationType } = inputs;
    const numWidth = parseFloat(width);
    const numHeight = parseFloat(height);
    const numGsm = parseFloat(gsm);
    const numQty = parseInt(quantity);
    const numRatePerKg = parseFloat(ratePerKg);

    if (isNaN(numWidth) || isNaN(numHeight) || isNaN(numGsm) || isNaN(numQty) || isNaN(numRatePerKg)) {
      setError("Please fill all fields correctly.");
      return;
    }

    let openW = envelopeType === "kotak" ? numWidth + 1 : Math.min(1, numWidth * 0.15) + numWidth + 0.5;
    let openH = envelopeType === "kotak" ? Math.min(1.25, numHeight * 0.2) + numHeight + (numHeight * 0.9) : numHeight * 2 + 0.5;

    let bestFit = null;
    let fitCandidates = [];
    envFullSheets.forEach(sheet => {
      [{ sw: sheet.w, sh: sheet.h }, { sw: sheet.h, sh: sheet.w }].forEach(orient => {
        let usableW = orient.sw - 0.8;
        let usableH = orient.sh - 0.3;
        let fitW = Math.floor(usableW / openW);
        let fitH = Math.floor(usableH / openH);
        let ups = fitW * fitH;
        let usedArea = ups * (openW * openH);
        let usableArea = usableW * usableH;
        let wastage = usableArea - usedArea;
        if (ups > 0) {
          fitCandidates.push({
            name: sheet.name, ups, wastage, usedArea, usableArea,
            sheetArea: sheet.w * sheet.h, originalSheet: sheet, appliedOrientation: orient
          });
        }
      });
    });

    fitCandidates.sort((a, b) => a.wastage - b.wastage);
    if (fitCandidates.length > 0) bestFit = fitCandidates[0];

    if (numQty > 20000 && (numWidth === 9.25 && numHeight === 4.25)) {
        const nineteenXTwentyFiveSheet = envFullSheets.find(s => s.name === "19x25");
        if (nineteenXTwentyFiveSheet) {
          let best19x25FitForEnvelope = null;
          [{ sw: nineteenXTwentyFiveSheet.w, sh: nineteenXTwentyFiveSheet.h }, { sw: nineteenXTwentyFiveSheet.h, sh: nineteenXTwentyFiveSheet.w }].forEach(orient => {
            let usableW = orient.sw - 0.8; let usableH = orient.sh - 0.3;
            let fitW = Math.floor(usableW / openW); let fitH = Math.floor(usableH / openH);
            let ups = fitW * fitH;
            if (ups > 0) {
              if (!best19x25FitForEnvelope || ups > best19x25FitForEnvelope.ups) {
                best19x25FitForEnvelope = { name: nineteenXTwentyFiveSheet.name, ups, wastage: (usableW * usableH) - (ups * openW * openH), sheetArea: nineteenXTwentyFiveSheet.w * nineteenXTwentyFiveSheet.h };
              }
            }
          });
          if (best19x25FitForEnvelope) bestFit = best19x25FitForEnvelope;
        }
      }

    if (!bestFit) {
      setError("Envelope too large for available paper sizes.");
      return;
    }

    const wastageSheets = numQty > 10000 ? Math.ceil(numQty / bestFit.ups * 0.03) : numQty > 6000 ? 300 : numQty > 4000 ? 225 : numQty > 2000 ? 150 : 100;
    const estimateshet = Math.ceil(numQty / bestFit.ups);
    const totalSheets = estimateshet + wastageSheets;
    const paperCostPerSheet = (bestFit.sheetArea * numGsm * numRatePerKg) / 3100 / 500;
    const paperCost = paperCostPerSheet * totalSheets;
    const totalImpressions = Math.ceil((estimateshet + wastageSheets) / 1000);
    const printingCost = bestFit.name === "20x30" ? totalImpressions * 500 + 2200 : totalImpressions * 400 + 1700;
    
    let makingCost;
    if (makingType === "direct") {
      let makingRate = numQty > 30000 ? 250 : numQty > 10000 ? 300 : 400;
      if (paperType === "Artpaper") makingRate = 900;
      else if (paperType === "Artcard") makingRate = 1200;
      makingCost = makingRate * Math.ceil(numQty / 1000);
    } else {
      let perQtyCost;
      if (numQty < 6000) perQtyCost = (paperType === "Artpaper") ? 500 : (paperType === "Artcard") ? 800 : 400;
      else if (numQty >= 6000 && numQty < 15000) perQtyCost = (paperType === "Artpaper") ? 400 : (paperType === "Artcard") ? 700 : 350;
      else perQtyCost = (paperType === "Artpaper") ? 350 : (paperType === "Artcard") ? 600 : 300;
      makingCost = (Math.ceil(estimateshet / 1000) * 400) + (Math.ceil(numQty / 1000) * perQtyCost);
    }

    const dieCost = dieType === "old" ? 300 : ["12x23", "12x25", "15x20"].includes(bestFit.name) ? 1500 : 2000;
    
    let gummingRate = numQty > 20000 ? 150 : numQty > 10000 ? 200 : numQty > 5000 ? 250 : 300;
    let gummingCost = addGummingFlap ? gummingRate * Math.ceil(numQty / 1000) : 0;

    let windowRate = numQty > 20000 ? 80 : numQty > 10000 ? 120 : numQty > 5000 ? 150 : 200;
    let windowCost = addWindow ? windowRate * Math.ceil(numQty / 1000) : 0;

    let laminationCost = 0;
    if (laminationType !== "none") {
      // Find lamination rate from master data by ID
      const selectedLamination = laminationTypes.find(lam => 
        lam.id.toString() === laminationType.toString()
      );
      const laminationRate = selectedLamination ? selectedLamination.rate : 0;
      
      // Formula: total sheets * best fit area * lamination rate / 100
      laminationCost = totalSheets * bestFit.sheetArea * laminationRate / 100;
    }

    let totalCost = paperCost + printingCost + makingCost + dieCost + gummingCost + windowCost + laminationCost;
    
    const selectedCustomer = customers.find(c => c.customerName === inputs.customerName);
    const margin = selectedCustomer ? parseFloat(selectedCustomer.margin) : 0;

    if (margin > 0) {
        totalCost *= (1 + margin / 100);
    }

    const finalRate = totalCost / numQty;

    setEnvelopeResult(prevResult => [...prevResult, {
      quantity: numQty,
      size: `${numWidth} x ${numHeight}`,
      paper: `${numGsm} GSM ${paperType}`,
      totalAmount: totalCost.toFixed(2),
      ratePerPiece: finalRate.toFixed(2),
      openSize: `${openW.toFixed(2)} x ${openH.toFixed(2)}`,
      bestFitSheet: `${bestFit.name} (${bestFit.originalSheet.w}x${bestFit.originalSheet.h})`,
      ups: bestFit.ups,
      totalSheets: totalSheets,
      paperCost: paperCost.toFixed(2),
      printingCost: printingCost.toFixed(2),
      makingCost: makingCost.toFixed(2),
      dieCost: dieCost.toFixed(2),
      laminationCost: laminationCost.toFixed(2),
      gummingCost: gummingCost.toFixed(2),
      windowCost: windowCost.toFixed(2),
    }]);
  };

  const handleSave = () => {
    if (envelopeResult.length === 0) {
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
        productType: 'Envelope',
        serial: formData && formData.serial ? formData.serial : getNextSerial(),
        customerName: inputs.customerName,
        inputs: inputs,
        results: envelopeResult,
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
    setEnvelopeResult(envelopeResult.filter((_, i) => i !== index));
  };

  const handleAdjustment = (direction) => {
    const percentage = parseFloat(adjustmentPercentage) || 0;
    if (percentage === 0) return;
    const multiplier = direction === 'add' ? (1 + percentage / 100) : (1 - percentage / 100);
    setEnvelopeResult(prevResult => prevResult.map(r => {
      const newTotalAmount = parseFloat(r.totalAmount) * multiplier;
      const newRatePerPiece = newTotalAmount / r.quantity;
      return { ...r, totalAmount: newTotalAmount.toFixed(2), ratePerPiece: newRatePerPiece.toFixed(2) };
    }));
  };

  const handleAmountAdjustment = (direction) => {
    const amount = parseFloat(adjustmentAmount) || 0;
    if (amount === 0) return;
    const adjustment = direction === 'add' ? amount : -amount;
    setEnvelopeResult(prevResult => prevResult.map(r => {
      const newTotalAmount = parseFloat(r.totalAmount) + adjustment;
      const newRatePerPiece = newTotalAmount / r.quantity;
      return { ...r, totalAmount: newTotalAmount.toFixed(2), ratePerPiece: newRatePerPiece.toFixed(2) };
    }));
  };

  return (
   <div className={`cuttosheet-flex-container ${envelopeResult.length > 0 ? 'results-visible' : ''}`}>
      <div className="cuttosheet-box cuttosheet-form-box">
        <h1 className="form-title-pink">Envelope Quotation</h1>
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
              <label className="input-label" htmlFor="quantity">Quantity</label>
              <input type="number" id="quantity" name="quantity" className="input-box" placeholder="e.g., 1000" value={inputs.quantity} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="standardSize">Standard Size</label>
              <select id="standardSize" name="standardSize" className="input-box" value={inputs.standardSize} onChange={handleInputChange}>
                <option value="">-- Select Standard Size --</option>
                <option value="A4Center">A4 Center Pasting</option>
                <option value="ChqKotak">Chq Size Kotak</option>
                <option value="ChqRegular">Chq Size Regular</option>
                <option value="NineFiveKotak">9.5x4.5 Kotak</option>
                <option value="NineFiveCenter">9.5x4.5 Center Pasting</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="envelopeType">Envelope Type</label>
              <select id="envelopeType" name="envelopeType" className="input-box" value={inputs.envelopeType} onChange={handleInputChange}>
                <option value="kotak">Kotak</option>
                <option value="centerPasting">Center Pasting</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="width">Width (inches)</label>
              <input type="number" id="width" name="width" className="input-box" step="0.01" placeholder="e.g., 9.5" value={inputs.width} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="height">Height (inches)</label>
              <input type="number" id="height" name="height" className="input-box" step="0.01" placeholder="e.g., 4.5" value={inputs.height} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="gsm">GSM</label>
              <input type="number" id="gsm" name="gsm" className="input-box" placeholder="e.g., 100" value={inputs.gsm} onChange={(e) => {
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
            <div className="form-group">
              <label className="input-label" htmlFor="ratePerKg">Rate per Kg</label>
              <input type="number" id="ratePerKg" name="ratePerKg" className="input-box" placeholder="e.g., 80" value={inputs.ratePerKg} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="makingType">Making Type</label>
              <select id="makingType" name="makingType" className="input-box" value={inputs.makingType} onChange={handleInputChange}>
                <option value="punching">Punching & Pasting</option>
                <option value="direct" disabled={inputs.paperType === 'Artcard' || inputs.paperType === 'Artpaper'}>Direct Pasting</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="dieType">Die Type</label>
              <select id="dieType" name="dieType" className="input-box" value={inputs.dieType} onChange={handleInputChange}>
                <option value="old">Old</option>
                <option value="new">New (as per Artwork)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label" htmlFor="laminationType">Lamination</label>
              <select id="laminationType" name="laminationType" className="input-box" value={inputs.laminationType} onChange={handleInputChange}>
                <option value="none">None</option>
                {laminationTypes && laminationTypes.map(lamination => (
                  <option key={lamination.id} value={lamination.id}>
                    {lamination.laminationName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group form-checkbox-group flex-center">
              <label className="modern-toggle-label"><input type="checkbox" name="addGummingFlap" className="modern-toggle" checked={inputs.addGummingFlap} onChange={handleInputChange} /><span>Add Gumming Flap</span></label>
            </div>
            <div className="form-group form-checkbox-group flex-center">
              <label className="modern-toggle-label"><input type="checkbox" name="addWindow" className="modern-toggle" checked={inputs.addWindow} onChange={handleInputChange} /><span>Add Window</span></label>
            </div>
          </div>
          <div className="center-align-container">
            <button type="button" className="save-btn-modern" onClick={calculateEnvelopeCost}>Calculate</button>
          </div>
        </form>
        <Modal show={!!error} onClose={() => setError('')}>
            <p className="text-lg text-red-600">{error}</p>
        </Modal>
      </div>
      {envelopeResult.length > 0 && (
        <div className="cuttosheet-box cuttosheet-result-box">
            <h3 className="form-title-pink">Quotation Details</h3>
            <div className="overflow-x-auto mb-4">
                <table className="result-table-modern compact-table">
                    <thead>
                        <tr>
                            <th>Quotation - {formData && formData.serial ? formData.serial : getNextSerial()}</th>
                            {envelopeResult.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Quantity</td>
                            {envelopeResult.map((r, i) => <td key={i}>{r.quantity}</td>)}
                        </tr>
                        <tr>
                            <td>Size</td>
                            {envelopeResult.map((r, i) => <td key={i}>{r.size}</td>)}
                        </tr>
                        <tr>
                            <td>Paper</td>
                            {envelopeResult.map((r, i) => <td key={i}>{capitalizeFirstLetter(r.paper)}</td>)}
                        </tr>
                        <tr>
                            <td>Making Type</td>
                            {envelopeResult.map((r, i) => <td key={i}>{inputs.makingType === 'punching' ? 'Punching & Pasting' : 'Direct Pasting'}</td>)}
                        </tr>
                        <tr>
                            <td>Die Type</td>
                            {envelopeResult.map((r, i) => <td key={i}>{inputs.dieType === 'old' ? 'Old' : 'New (as per Artwork)'}</td>)}
                        </tr>
                        {inputs.laminationType !== 'none' && (
                            <tr>
                                <td>Lamination</td>
                                {envelopeResult.map((r, i) => <td key={i}>{capitalizeFirstLetter(
                                    laminationTypes.find(lam => lam.id.toString() === inputs.laminationType.toString())?.laminationName || inputs.laminationType
                                )} Oneside</td>)}
                            </tr>
                        )}
                        {(inputs.addGummingFlap || inputs.addWindow) && (
                            <tr>
                                <td>Additional Features</td>
                                {envelopeResult.map((r, i) => <td key={i}>{[inputs.addGummingFlap && 'Gumming Flap', inputs.addWindow && 'Window'].filter(Boolean).join(', ')}</td>)}
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
                        {envelopeResult.map((r, i) => (
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
                            {envelopeResult.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Paper Cost</td>
                            {envelopeResult.map((r, i) => <td key={i}>₹{r.paperCost}</td>)}
                        </tr>
                        <tr>
                            <td>Printing Cost</td>
                            {envelopeResult.map((r, i) => <td key={i}>₹{r.printingCost}</td>)}
                        </tr>
                        <tr>
                            <td>Making Cost</td>
                            {envelopeResult.map((r, i) => <td key={i}>₹{r.makingCost}</td>)}
                        </tr>
                        <tr>
                            <td>Die Cost</td>
                            {envelopeResult.map((r, i) => <td key={i}>₹{r.dieCost}</td>)}
                        </tr>
                        {envelopeResult.some(r => r.laminationCost > 0) && (
                            <tr>
                                <td>Lamination Cost</td>
                                {envelopeResult.map((r, i) => <td key={i}>₹{r.laminationCost}</td>)}
                            </tr>
                        )}
                        {envelopeResult.some(r => r.gummingCost > 0) && (
                            <tr>
                                <td>Gumming Cost</td>
                                {envelopeResult.map((r, i) => <td key={i}>₹{r.gummingCost}</td>)}
                            </tr>
                        )}
                        {envelopeResult.some(r => r.windowCost > 0) && (
                            <tr>
                                <td>Window Cost</td>
                                {envelopeResult.map((r, i) => <td key={i}>₹{r.windowCost}</td>)}
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto mb-4">
                <h4 className="text-lg font-semibold mb-3 text-gray-700">Paper Requirements</h4>
                <table className="result-table-modern compact-table">
                    <thead>
                        <tr>
                            <th>Details</th>
                            {envelopeResult.map((r, i) => <th key={i}>Option {i + 1}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>No of Sheet</td>
                            {envelopeResult.map((r, i) => <td key={i}>{r.totalSheets} sheets</td>)}
                        </tr>
                        <tr>
                            <td>Sheet Size</td>
                            {envelopeResult.map((r, i) => <td key={i}>{r.bestFitSheet}</td>)}
                        </tr>
                        <tr>
                            <td>UPS</td>
                            {envelopeResult.map((r, i) => <td key={i}>{r.ups}</td>)}
                        </tr>
                        <tr>
                            <td>Open Size</td>
                            {envelopeResult.map((r, i) => <td key={i}>{r.openSize}</td>)}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default Envelope;
