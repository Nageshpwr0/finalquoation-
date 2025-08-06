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

function JobCard({ customers, quotations, apiUrl, onSaved, paperTypes }) {
  const [showList, setShowList] = useState(false);
  const [editingJobCard, setEditingJobCard] = useState(null);
  const [processRows, setProcessRows] = useState([{
    forms: '', sideCount: '', qty: '', extraSheets: '', type: '', machine: '',
    lamination: '', externalPre: '', externalPre2: '', punching: '', external: '', binding: ''
  }]);
  const [bookletDataLoaded, setBookletDataLoaded] = useState(false);
  const [processDetailsAutoFilled, setProcessDetailsAutoFilled] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    quotationNumber: '',
    productName: '',
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
  const [showCoverPaper, setShowCoverPaper] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEdit = (jobCard) => {
    setEditingJobCard(jobCard);
    setShowList(false);
  };

  useEffect(() => {
    // Fetch only unused quotations for the dropdown
    fetch(`${apiUrl}/api/quotations?includeUsed=false`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          const sortedQuotations = data.data.sort((a, b) => b.serial - a.serial);
          setAvailableQuotations(sortedQuotations);
        }
      })
      .catch(error => {
        console.error('Error fetching quotations:', error);
      });


      
    const bookletProcessData = sessionStorage.getItem('bookletProcessDetails');
    if (bookletProcessData) {
      try {
        const data = JSON.parse(bookletProcessData);
        setFormData(prev => ({
          ...prev,
          customerName: data.customerName || '',
          quotationNumber: data.quotationNumber || '',
          productName: data.productName || 'Booklet'
        }));
        
        if (data.processDetails && data.processDetails.length > 0) {
          const convertedProcessRows = [];
          
          data.processDetails.forEach(detail => {
            convertedProcessRows.push({
              forms: detail.forms || '',
              sideCount: detail.sideCount || '',
              qty: detail.qty || '',
              extraSheets: detail.extraSheets || '',
              type: '',
              machine: '',
              lamination: detail.lamination || '',
              externalPre: detail.uvType && detail.uvType !== 'none' ? detail.uvType : '',
              externalPre2: detail.foilingType && detail.foilingType !== 'none' ? detail.foilingType : '',
              punching: '',
              external: detail.dripUpType && detail.dripUpType !== 'none' ? detail.dripUpType : '',
              binding: detail.binding || ''
            });
          });
          setProcessRows(convertedProcessRows);
          setBookletDataLoaded(true);
          setTimeout(() => setBookletDataLoaded(false), 5000);
        }
        
        sessionStorage.removeItem('bookletProcessDetails');
      } catch (error) {
        console.error('Error parsing booklet process details:', error);
      }
    }

    if (editingJobCard) {
      setFormData(editingJobCard);
      setProcessRows(editingJobCard.processDetails || []);
    }
  }, [apiUrl, editingJobCard]);

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
      }
    }
    
    if (name === 'ups' || name === 'qtyFullSheet') {
      const ups = name === 'ups' ? parseInt(value) || 0 : parseInt(newFormData.ups) || 0;
      const qtyFullSheet = name === 'qtyFullSheet' ? parseInt(value) || 0 : parseInt(formData.qtyFullSheet) || 0;
      newFormData.qtyCutSheet = ups * qtyFullSheet;
    }
    
    if (name === 'coverUps' || name === 'coverQtyFullSheet') {
      const coverUps = name === 'coverUps' ? parseInt(value) || 0 : parseInt(newFormData.coverUps) || 0;
      const coverQtyFullSheet = name === 'coverQtyFullSheet' ? parseInt(value) || 0 : parseInt(formData.coverQtyFullSheet) || 0;
      newFormData.coverQtyCutSheet = coverUps * coverQtyFullSheet;
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
    setProcessRows(updatedRows);
  };

  const removeProcessRow = (index) => {
    if (processRows.length > 1) {
      const updatedRows = processRows.filter((_, i) => i !== index);
      setProcessRows(updatedRows);
    }
  };

  const getProcessDetailsFromQuotationData = (quotation) => {
    const inputs = quotation.inputs || {};
    const results = quotation.results || [];
    const productType = quotation.productType;
    
    let processRows = [];
    
    if (productType === 'CutToSheet' && results.length > 0) {
      // Use only the first result
      const result = results[0];
      const bestFit = result.bestFitDetails || {};
      const runDetails = bestFit.runDetails || [];
      
      runDetails.forEach(run => {
          let forms = run.method === 'frontback' ? 'frontback' : run.method === 'selfback' ? 'selfback' : run.method === 'doublegripper' ? 'double_gripper' : 'oneside';
          
          // Calculate actual side count based on printing method and printing type
          let sideCount;
          if (run.method === 'oneside') {
            sideCount = 1;
          } else if (run.method === 'frontback') {
            sideCount = 2; // Front and back are separate runs
          } else if (run.method === 'selfback' || run.method === 'doublegripper') {
            sideCount = 2; // Both sides printed in single run
          } else {
            sideCount = inputs.printingType && inputs.printingType.includes('oneside') ? 1 : 2;
          }
          
          processRows.push({
            forms: forms,
            sideCount: sideCount.toString(),
            qty: run.sheets.toString(),
            extraSheets: '',
            type: '',
            machine: '',
            lamination: inputs.lamination && inputs.lamination !== 'none' ? inputs.laminationText || inputs.lamination : '',
            externalPre: inputs.additionalProcess && inputs.additionalProcess !== '0' ? inputs.additionalProcess : '',
            externalPre2: inputs.additionalProcess2 && inputs.additionalProcess2 !== '0' ? inputs.additionalProcess2 : '',
            punching: inputs.punching === 'yes' ? 'yes' : '',
            external: inputs.dieType && inputs.dieType !== '0' ? 'die' : '',
            binding: inputs.fabrication && inputs.fabrication !== '0' ? inputs.fabrication : ''
          });
        });
    } else if (productType === 'Booklet' && results.length > 0) {
      // Use only the first result
      const result = results[0];
        const resultInputs = result.inputs || inputs;
        const qty = resultInputs.qty || inputs.qty1;
        const pages = parseInt(resultInputs.pages || inputs.pages || 0);
        const paperSize = resultInputs.size || inputs.paperSize;
        const printingType = resultInputs.printing || inputs.printingType;
        
        const selectedPaper = paperOptions.find(p => p.value === paperSize);
        const ups = selectedPaper?.ups || 1;
        
        const innerForms = pages / ups;
        const wholeNumber = Math.floor(innerForms);
        const fractional = innerForms - wholeNumber;
        const wastage = qty <= 1500 ? 100 : qty <= 2500 ? 150 : qty <= 5000 ? 200 : qty <= 9000 ? 250 : qty <= 15000 ? 350 : 500;
        
        let forms = 'frontback';
        let baseSideCount = 2;
        
        if (printingType.includes('single') || printingType.includes('1+0') || printingType.includes('2+0') || printingType.includes('4+0')) {
          forms = 'oneside';
          baseSideCount = 1;
        }
        
        // Add frontback forms if wholeNumber > 0
        if (wholeNumber > 0) {
          processRows.push({
            forms: forms,
            sideCount: wholeNumber.toString(),
            qty: (qty + wastage).toString(), // Per-form qty from fit details "Sheet" column
            extraSheets: wastage.toString(),
            type: '',
            machine: '',
            lamination: resultInputs.lamination && resultInputs.lamination !== 'none' ? resultInputs.lamination : '',
            externalPre: resultInputs.uvType && resultInputs.uvType !== 'none' ? resultInputs.uvType : '',
            externalPre2: resultInputs.foilingType && resultInputs.foilingType !== 'none' ? resultInputs.foilingType : '',
            punching: '',
            external: resultInputs.dripUpType && resultInputs.dripUpType !== 'none' ? resultInputs.dripUpType : '',
            binding: resultInputs.bindingType || ''
          });
        }
        
        // Add selfback forms if fractional > 0
        if (fractional > 0) {
          let selfBackCount = 0;
          if (fractional === 0.5 || fractional === 0.25) {
            selfBackCount = 1;
          } else if (fractional === 0.75) {
            selfBackCount = 2;
          } else {
            selfBackCount = Math.ceil(fractional / 0.25);
          }
          
          const fractionalSheets = Math.floor(qty * fractional);
          processRows.push({
            forms: 'selfback',
            sideCount: selfBackCount.toString(),
            qty: fractionalSheets.toString(), // Per-form qty from fit details "Sheet" column
            extraSheets: wastage.toString(),
            type: '',
            machine: '',
            lamination: resultInputs.lamination && resultInputs.lamination !== 'none' ? resultInputs.lamination : '',
            externalPre: resultInputs.uvType && resultInputs.uvType !== 'none' ? resultInputs.uvType : '',
            externalPre2: resultInputs.foilingType && resultInputs.foilingType !== 'none' ? resultInputs.foilingType : '',
            punching: '',
            external: resultInputs.dripUpType && resultInputs.dripUpType !== 'none' ? resultInputs.dripUpType : '',
            binding: resultInputs.bindingType || ''
          });
        }
        
        // Add cover forms if cover GSM > 0
        if (resultInputs.coverGsm && parseInt(resultInputs.coverGsm) > 0) {
          const coverForms = 4 / ups;
          const coverWhole = Math.floor(coverForms);
          const coverFractional = coverForms - coverWhole;
          const coverWastage = qty / 2 <= 2100 ? 100 : qty / 2 <= 4000 ? 150 : qty / 2 <= 5000 ? 200 : qty / 2 <= 9000 ? 250 : qty / 2 <= 15000 ? 350 : 500;
          
          if (coverWhole > 0) {
            processRows.push({
              forms: 'frontback',
              sideCount: coverWhole.toString(),
              qty: qty.toString(),
              extraSheets: coverWastage.toString(),
              type: 'Cover',
              machine: '',
              lamination: resultInputs.coverLamination && resultInputs.coverLamination !== 'none' ? resultInputs.coverLamination : '',
              externalPre: resultInputs.uvType && resultInputs.uvType !== 'none' ? resultInputs.uvType : '',
              externalPre2: resultInputs.foilingType && resultInputs.foilingType !== 'none' ? resultInputs.foilingType : '',
              punching: '',
              external: resultInputs.dripUpType && resultInputs.dripUpType !== 'none' ? resultInputs.dripUpType : '',
              binding: ''
            });
          }
          
          if (coverFractional > 0) {
            let coverSelfBack = 0;
            if (coverFractional === 0.5 || coverFractional === 0.25) {
              coverSelfBack = 1;
            } else if (coverFractional === 0.75) {
              coverSelfBack = 2;
            } else {
              coverSelfBack = Math.ceil(coverFractional / 0.25);
            }
            
            processRows.push({
              forms: 'selfback',
              sideCount: coverSelfBack.toString(),
              qty: Math.floor(qty * coverFractional).toString(),
              extraSheets: coverWastage.toString(),
              type: 'Cover',
              machine: '',
              lamination: resultInputs.coverLamination && resultInputs.coverLamination !== 'none' ? resultInputs.coverLamination : '',
              externalPre: resultInputs.uvType && resultInputs.uvType !== 'none' ? resultInputs.uvType : '',
              externalPre2: resultInputs.foilingType && resultInputs.foilingType !== 'none' ? resultInputs.foilingType : '',
              punching: '',
              external: resultInputs.dripUpType && resultInputs.dripUpType !== 'none' ? resultInputs.dripUpType : '',
              binding: ''
            });
          }
        }
    }
    
    return processRows.length > 0 ? processRows : [{
      forms: '', sideCount: '', qty: '', extraSheets: '', type: '', machine: '',
      lamination: '', externalPre: '', externalPre2: '', punching: '', external: '', binding: ''
    }];
  };

  const handleQuotationSelect = (e) => {
    const quotationSerial = e.target.value;
    setFormData(prev => ({
      ...prev,
      quotationNumber: quotationSerial
    }));

    if (quotationSerial) {
      const quotation = availableQuotations.find(q => q.serial.toString() === quotationSerial);
      if (quotation) {
        setSelectedQuotation(quotation);
        const inputs = quotation.inputs || {};
        const results = quotation.results || [];
        const bestFit = Array.isArray(results) && results.length > 0 ? results[0].bestFitDetails : null;
        
        const autoFilledProcessRows = getProcessDetailsFromQuotationData(quotation);
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
          // Use first result data if available, otherwise use inputs
          const firstResult = results.length > 0 ? results[0] : null;
          const resultInputs = firstResult?.inputs || inputs;
          
          const paperSizeMap = { 'A4': '18x23', 'A5': '18x23', 'A6': '12x23' };
          const paperSize = resultInputs.size || inputs.paperSize || 'A4';
          sheetSize = paperSizeMap[paperSize] || '18x23';
          const pages = parseInt(resultInputs.pages || inputs.pages || 0);
          const qty = parseInt(resultInputs.qty || inputs.qty1 || 0);
          const cutSizeData = getCutSizeToSheetMapping(sheetSize);
          jobUps = cutSizeData ? cutSizeData.ups : 2;
          const sheetsPerBooklet = Math.ceil(pages / (jobUps * 4));
          totalSheets = sheetsPerBooklet * qty;
          paperGsm = resultInputs.gsm || inputs.gsm || '';
          paperType = resultInputs.paperType || inputs.paperType || '';
          jobColor = resultInputs.printing || inputs.printingType || '';
          
          // Auto-open cover paper details for Booklet quotations
          setShowCoverPaper(true);
        }
        
        const cutSizeData = getCutSizeToSheetMapping(sheetSize);
        const qtyFullSheet = jobUps > 0 ? Math.ceil(totalSheets / jobUps) : totalSheets;
        
        setFormData(prev => ({
          ...prev,
          customerName: quotation.customerName || '',
          productName: quotation.productType || '',
          paperGsm: paperGsm,
          paperType: paperType,
          cutSize: sheetSize,
          ups: jobUps,
          qtyFullSheet: qtyFullSheet,
          qtyCutSheet: totalSheets,
          paperLength: cutSizeData?.paperLength || '',
          paperWidth: cutSizeData?.paperWidth || '',
          jobColor: jobColor,
          // Auto-fill cover paper details
          coverPaperLength: cutSizeData?.paperLength || '',
          coverPaperWidth: cutSizeData?.paperWidth || '',
          coverCutSize: sheetSize,
          coverUps: jobUps,
          coverQtyCutSheet: quotation.productType === 'Booklet' ? (() => {
            const firstResult = results.length > 0 ? results[0] : null;
            const resultInputs = firstResult?.inputs || inputs;
            const bookletQty = parseInt(resultInputs.qty || inputs.qty1 || 0);
            const coverWastage = bookletQty / 2 <= 2100 ? 100 : bookletQty / 2 <= 4000 ? 150 : bookletQty / 2 <= 5000 ? 200 : bookletQty / 2 <= 9000 ? 250 : bookletQty / 2 <= 15000 ? 350 : 500;
            return (bookletQty + coverWastage);
          })() : totalSheets,
          coverQtyFullSheet: quotation.productType === 'Booklet' ? (() => {
            const firstResult = results.length > 0 ? results[0] : null;
            const resultInputs = firstResult?.inputs || inputs;
            const bookletQty = parseInt(resultInputs.qty || inputs.qty1 || 0);
            const coverWastage = bookletQty / 2 <= 2100 ? 100 : bookletQty / 2 <= 4000 ? 150 : bookletQty / 2 <= 5000 ? 200 : bookletQty / 2 <= 9000 ? 250 : bookletQty / 2 <= 15000 ? 350 : 500;
            return Math.ceil((bookletQty + coverWastage) / jobUps);
          })() : qtyFullSheet,
          coverPaperGsm: (results.length > 0 ? results[0].inputs?.coverGsm : null) || inputs.coverGsm || paperGsm,
          coverPaperType: paperType,
          coverPaperBy: 'us'
        }));
      }
    } else {
      setSelectedQuotation(null);
      setProcessRows([{
        forms: '', sideCount: '', qty: '', extraSheets: '', type: '', machine: '',
        lamination: '', externalPre: '', externalPre2: '', punching: '', external: '', binding: ''
      }]);
      setProcessDetailsAutoFilled(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.productName || !formData.jobName) {
      alert('Please fill in all required fields (Customer, Product Name, Job Name)');
      return;
    }
    
    try {
      const jobCardData = {
        ...formData,
        processDetails: processRows
      };
      
      console.log('Job Card Data being sent:', jobCardData);
      console.log('Data size:', JSON.stringify(jobCardData).length, 'bytes');
      
      const url = editingJobCard ? `${apiUrl}/api/jobcards/${editingJobCard.id}` : `${apiUrl}/api/jobcards`;
      const method = editingJobCard ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobCardData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        const textResponse = await response.text();
        console.error('Raw response:', textResponse);
        alert('Server returned invalid response. Check console for details.');
        return;
      }
      
      console.log('Job Card API Response:', data);

      if (response.ok) {
        alert(`Job Card ${editingJobCard ? 'updated' : 'created'} successfully! Job Card Number: ${data.data?.jobCardNum || data.jobCardNum}`);
        
        // Refresh available quotations to remove the used one
        if (!editingJobCard && formData.quotationNumber) {
          fetch(`${apiUrl}/api/quotations?includeUsed=false`)
            .then(res => res.json())
            .then(quotData => {
              if (quotData && quotData.data) {
                const sortedQuotations = quotData.data.sort((a, b) => b.serial - a.serial);
                setAvailableQuotations(sortedQuotations);
              }
            })
            .catch(error => {
              console.error('Error refreshing quotations:', error);
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
        console.log('Setting showList to true and refreshTrigger to:', Date.now());
        setShowList(true);
        setRefreshTrigger(Date.now());
        if (onSaved) onSaved();
      } else {
        console.error('Server error response:', data);
        alert(`Error creating job card: ${data.error || data.message || 'Unknown server error'}`);
      }
    } catch (error) {
      console.error('Network or other error:', error);
      alert(`Error creating job card: ${error.message}`);
    }
  };

  if (showList) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button 
            onClick={() => setShowList(false)}
            className="save-btn-modern"
          >
            ← Create New Job Card
          </button>
        </div>
        <JobCardList apiUrl={apiUrl} refreshTrigger={refreshTrigger} onEdit={handleEdit} />
      </div>
    );
  }

  return (
    <div className="form-container-modern">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="form-title-pink">Create Job Card</h2>
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
          <button 
            onClick={() => setShowList(true)}
            className="save-btn-modern"
          >
            View Job Cards →
          </button>
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
                Only unused quotations shown
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
            <label className="form-label-modern">Product Name *</label>
            <select
              name="productName"
              value={formData.productName}
              onChange={handleInputChange}
              className="input-field-modern"
              required
            >
              <option value="">Select Product</option>
              <option value="CutToSheet">CutToSheet</option>
              <option value="Booklet">Booklet</option>
              <option value="Poster">Poster</option>
              <option value="Envelope">Envelope</option>
              <option value="Bag">Bag</option>
              <option value="Calendar">Calendar</option>
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
              value="JC01"
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
            <h3 className="section-title">Paper Details</h3>
            <button 
              type="button" 
              onClick={() => setShowCoverPaper(!showCoverPaper)}
              className="save-btn-modern"
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              {showCoverPaper ? 'Hide Cover Paper' : 'Cover Paper Details'}
            </button>
          </div>
          <div className="paper-grid-9">

          <div className="form-group-modern col-span-1">
            <label className="form-label-modern">Paper Length</label>
            <input
              type="number"
              name="paperLength"
              value={formData.paperLength}
              onChange={handleInputChange}
              className="input-field-modern"
              step="0.01"
            />
          </div>

          <div className="form-group-modern col-span-1">
            <label className="form-label-modern">Paper Width</label>
            <input
              type="number"
              name="paperWidth"
              value={formData.paperWidth}
              onChange={handleInputChange}
              className="input-field-modern"
              step="0.01"
            />
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Cut Size</label>
            <input
              type="text"
              name="cutSize"
              value={formData.cutSize}
              onChange={handleInputChange}
              className="input-field-modern"
            />
          </div>

          <div className="form-group-modern col-span-1">
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
            <label className="form-label-modern">Qty Full Sheet</label>
            <input
              type="number"
              name="qtyFullSheet"
              value={formData.qtyFullSheet}
              onChange={handleInputChange}
              className="input-field-modern"
            />
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

          <div className="form-group-modern col-span-1">
            <label className="form-label-modern">Paper GSM</label>
            <input
              type="number"
              name="paperGsm"
              value={formData.paperGsm}
              onChange={handleInputChange}
              className="input-field-modern"
            />
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">Paper Type</label>
            <select
              name="paperType"
              value={formData.paperType}
              onChange={handleInputChange}
              className="input-field-modern"
            >
              <option value="">Select Paper Type</option>
              {paperTypes.map((paperType) => (
                <option key={paperType.id} value={paperType.paperTypeName}>
                  {paperType.paperTypeName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group-modern col-span-1">
            <label className="form-label-modern">Paper By *</label>
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
                    <option value="frontback">Front Back</option>
                    <option value="selfback">Self Back</option>
                    <option value="oneside">One Side</option>
                    <option value="double_gripper">Double Gripper</option>
                  </select>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Side Count</label>
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
                  <label className="form-label-modern">Machine</label>
                  <select
                    value={row.machine}
                    onChange={(e) => updateProcessRow(index, 'machine', e.target.value)}
                    className="input-field-modern"
                  >
                    <option value="">Select Machine</option>
                    <option value="Komori 426">Komori 426</option>
                    <option value="Komori 529">Komori 529</option>
                    <option value="Heidelberg">Heidelberg</option>
                  </select>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Lamination</label>
                  <input
                    type="text"
                    value={row.lamination}
                    onChange={(e) => updateProcessRow(index, 'lamination', e.target.value)}
                    className="input-field-modern"
                  />
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

        <div className="form-actions-modern">
          <button type="submit" className="save-btn-modern">
            {editingJobCard ? 'Update Job Card' : 'Create Job Card'}
          </button>
        </div>
      </form>

      {selectedQuotation && (
        <div className="quotation-preview" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #3B82F6' }}>
          <h3 style={{ color: '#1E40AF', marginBottom: '10px' }}>Selected Quotation Details:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <p><strong>Serial:</strong> #{selectedQuotation.serial}</p>
            <p><strong>Customer:</strong> {selectedQuotation.customerName}</p>
            <p><strong>Product:</strong> {selectedQuotation.productType}</p>
            <p><strong>Date:</strong> {new Date(selectedQuotation.createdAt || Date.now()).toLocaleDateString()}</p>
          </div>
          <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#DBEAFE', borderRadius: '4px', fontSize: '0.85rem' }}>
            <strong>Process Details:</strong> Auto-filled {processRows.filter(row => row.forms !== '').length} process row(s) from this quotation
          </div>
        </div>
      )}
    </div>
  );
}

export default JobCard;