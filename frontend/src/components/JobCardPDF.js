import jsPDF from 'jspdf';
import 'jspdf-autotable';

const generatePdf = (jobCard, laminationTypes = []) => {
  console.log('=== PDF GENERATION START ===');
  console.log('Job Card data received for PDF:', jobCard);
  console.log('Quotation details in PDF:', jobCard.quotationDetails);

  // The full jobCard object, including quotationDetails, is now passed directly
  const quotationDetails = jobCard.quotationDetails || {};
  const quotationResults = quotationDetails?.results || [];
  const firstResult = quotationResults[0] || {};
  
  const doc = new jsPDF();

  // --- HEADER ---
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('JOB CARD', 5, 10, { align: 'left' });

  doc.setDrawColor(0);
  doc.rect(5, 15, 25, 25);
  doc.setFontSize(6);
  doc.text('LOGO', 17.5, 29, { align: 'center' });

  // Job Card Header Table
  const headerData = [
    ['JOB CARD NO', jobCard.jobCardNum || 'N/A'],
    ['JOB NAME', jobCard.jobName || 'N/A'],
    ['CUSTOMER NAME', jobCard.customerName || 'N/A'],
    ['PO NO', jobCard.poNumber || 'N/A'],
    ['QUOTATION NO', jobCard.quotationNumber || 'N/A']
  ];

  doc.autoTable({
    body: headerData,
    startY: 8.5,
    margin: { left: 85 },
    tableWidth: 115,
    theme: 'grid',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 80 }
    },
    styles: {
      fontSize: 10,
      cellPadding: 1.5,
      textColor: [0, 0, 0]
    }
  });

  const priority = jobCard.priority || 'regular';
  const priorityColor = priority.includes('urgent') ? [255, 0, 0] : [0, 0, 255];
  doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
  doc.rect(5, 45, 200, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`PRIORITY: ${priority.toUpperCase().replace('_', ' ')}`, 105, 50, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // --- IMAGE AREA ---
  const imageAreaWidth = 100;
  const imageAreaHeight = 70;
  const startY = 57;
  doc.setDrawColor(0);
  doc.rect(5, startY, imageAreaWidth, imageAreaHeight);
  if (jobCard.imageData) {
    try {
      doc.addImage(jobCard.imageData, 'JPEG', 6, startY + 1, imageAreaWidth - 2, imageAreaHeight - 2);
    } catch (error) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('IMAGE UNAVAILABLE', 55, startY + 35, { align: 'center' });
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('IMAGE AREA', 55, startY + 35, { align: 'center' });
  }

  // --- QUOTATION INPUT DETAILS ---
  const quotationInputStartX = 110;
  console.log('=== QUOTATION SECTION ===');
  console.log('Job Card full data:', jobCard);
  console.log('Quotation details for PDF:', quotationDetails);
  console.log('Quotation details exists?', !!quotationDetails);
  console.log('Quotation details inputs?', quotationDetails?.inputs);
  
  const quotationInputs = quotationDetails?.inputs || {};
  const inputDetailsData = [];

  const labelMap = {
    customerName: 'Customer',
    qty: 'Quantity',
    qty1: 'Quantity',
    noOfLeaves: 'NoOfLeaves',
    jobWidth: 'Width',
    jobHeight: 'Height',
    paperSize: 'Paper Size',
    size: 'Size',
    gsm: 'GSM',
    rate: 'Rate',
    paperType: 'Paper Type',
    paperTypeText: 'PaperTypeText',
    printingType: 'Printing',
    printing: 'Printing',
    pages: 'Pages',
    lamination: 'Lamination',
    laminationText: 'LaminationText',
    bindingType: 'Binding Type',
    binding: 'Binding',
    additionalProcess: 'Additional Process',
    additionalProcess2: 'Additional Process 2',
    punching: 'Punching',
    dieType: 'Die Type',
    fabrication: 'Fabrication',
    fabricationN: 'Fabrication 2',
    uvType: 'UV Type',
    foilingType: 'Foiling Type',
    dripUpType: 'Drip Up Type',
    coverGsm: 'Cover GSM',
    coverPrintingColor: 'Cover Printing',
    coverLamination: 'Cover Lamination'
  };

  inputDetailsData.push(['Product', jobCard.productName || 'N/A']);
  
  // Debug and force display quotation details
  console.log('quotationInputs:', quotationInputs);
  console.log('quotationDetails:', quotationDetails);
  console.log('jobCard.quotationNumber:', jobCard.quotationNumber);
  
  // Display actual quotation data
  if (quotationDetails && quotationDetails.inputs) {
    const inputs = quotationDetails.inputs;
    const processedKeys = new Set([
        'customerName', 'rate', 'paperType', 'jobHeight',
        'gsm', 'coverGsm',
        'lamination', 'coverLamination', 'laminationText',
        'printing', 'coverPrintingColor', 'printingType',
        'pages', // Handle 'pages' separately to enforce order
        // These are now handled in separate tables at the end
        'uvType', 'foilingType', 'dripUpType',
        'additionalProcess', 'additionalProcess2',
        'punching', 'dieType',
        'fabrication', 'fabricationN',
        'bindingType', 'binding'
    ]);

    // --- Other Fields (that should appear before combined fields) ---
    Object.entries(inputs).forEach(([key, value]) => {
        if (processedKeys.has(key)) {
            return; // Skip if it will be handled later or is in the skip list
        }

        if (value && value !== 'none' && value !== '0' && value !== 0) {
            const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
            
            if (key === 'jobWidth' && inputs.jobHeight) {
                inputDetailsData.push([label, `${value} × ${inputs.jobHeight}`]);
            } else if (key === 'dieType') {
                const dieValue = firstResult.dieTypeText || value;
                inputDetailsData.push([label, String(dieValue)]);
            } else {
                inputDetailsData.push([label, String(value)]);
            }
        }
    });

    // --- Pages (to ensure it's in the right order) ---
    if (inputs.pages && inputs.pages !== '0') {
        inputDetailsData.push(['Pages', inputs.pages]);
    }

    // --- Combined Fields (to appear after Pages) ---
    // GSM
    const gsmValue = inputs.gsm && inputs.gsm !== '0' ? `GSM - ${inputs.gsm}` : '';
    const coverGsmValue = inputs.coverGsm && inputs.coverGsm !== '0' ? `Cover - ${inputs.coverGsm}` : '';
    const combinedGsm = [gsmValue, coverGsmValue].filter(Boolean).join(', ');
    if (combinedGsm) {
        inputDetailsData.push(['GSM', combinedGsm]);
    }

    // Lamination is now handled in its own table at the end of the document

    // Printing
    const printingValue = inputs.printing && inputs.printing !== 'none' ? `Printing - ${inputs.printing}` : '';
    const coverPrintingValue = inputs.coverPrintingColor && inputs.coverPrintingColor !== 'none' ? `Cover - ${inputs.coverPrintingColor}` : '';
    const combinedPrinting = [printingValue, coverPrintingValue].filter(Boolean).join(', ');
    if (combinedPrinting) {
        inputDetailsData.push(['Printing', combinedPrinting]);
    }

    // --- Binding (to ensure it's at the end) ---
    if (inputs.bindingType && inputs.bindingType !== 'none') {
        const label = labelMap['bindingType'] || 'Binding Type';
        inputDetailsData.push([label, String(inputs.bindingType)]);
    }
    if (inputs.binding && inputs.binding !== 'none') {
        const label = labelMap['binding'] || 'Binding';
        inputDetailsData.push([label, String(inputs.binding)]);
    }

    // Special fields are now handled in their own tables at the end.
  }


  doc.autoTable({
    body: inputDetailsData,
    startY: startY,
    margin: { left: quotationInputStartX },
    theme: 'grid',
    headStyles: {
      fillColor: [65, 105, 225],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 60 }
    },
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
      textColor: [0, 0, 0]
    }
  });

  // --- PAPER DETAILS TABLES ---
  console.log('Job Card paper data:', jobCard);

  const paperTablesStartY = startY + imageAreaHeight + 6;
  
  const innerPaperData = [
    ['Cut Sheet Qty', jobCard.qtyCutSheet || 'N/A', 'Amt', ''],
    ['Paper Size', `${jobCard.cutSize || 'N/A'} (${jobCard.paperLength || 'N/A'} x ${jobCard.paperWidth || 'N/A'}), ${jobCard.ups || 'N/A'}ups`, '', ''],
    ['Paper GSM + Type', `${jobCard.paperGsm || 'N/A'} GSM ${jobCard.paperType || 'N/A'}`, '', '']
  ];

  const coverPaperData = [
    ['Cover Sheet Qty', jobCard.coverQtyCutSheet || 'N/A', 'Amt', ''],
    ['Cover Paper Size', `${jobCard.coverCutSize || 'N/A'} (${jobCard.coverPaperLength || 'N/A'} x ${jobCard.coverPaperWidth || 'N/A'}), ${jobCard.coverUps || 'N/A'}ups`, '', ''],
    ['Cover GSM + Type', `${jobCard.coverPaperGsm || 'N/A'} GSM ${jobCard.coverPaperType || 'N/A'}`, '', '']
  ];

  // Inner Paper Table
  doc.autoTable({
    body: innerPaperData,
    startY: paperTablesStartY,
    margin: { left: 5 },
    tableWidth: 95,
    theme: 'grid',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 40 },
      2: { fontStyle: 'bold', cellWidth: 15 },
      3: { cellWidth: 20 }
    },
    styles: {
      fontSize: 10,
      cellPadding: 2,
      textColor: [0, 0, 0]
    }
  });

  // Cover Paper Table - only show if cover paper data exists
  const hasCoverPaper = jobCard.coverPaperGsm && jobCard.coverPaperGsm !== 'N/A' && jobCard.coverPaperGsm !== '' && jobCard.coverPaperGsm !== '0';
  
  if (hasCoverPaper) {
    doc.autoTable({
      body: coverPaperData,
      startY: paperTablesStartY,
      margin: { left: 110 },
      tableWidth: 95,
      theme: 'grid',
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 35 },
        1: { cellWidth: 40 },
        2: { fontStyle: 'bold', cellWidth: 15 },
        3: { cellWidth: 20 }
      },
      styles: {
        fontSize: 10,
        cellPadding: 2,
        textColor: [0, 0, 0]
      }
    });
  }

  // --- PRINTING DETAILS TABLES ---
  const printingTablesStartY = doc.autoTable.previous.finalY + 6;
  
  const processData = jobCard.processDetails || [];
  console.log('Process data for PDF:', processData);
  
  // Separate inner and cover forms
  const innerForms = processData.filter(process => process.type === 'Inner');
  const coverForms = processData.filter(process => process.type === 'Cover');
  
  console.log('Inner forms:', innerForms);
  console.log('Cover forms:', coverForms);

  const printingTypeMap = {
    'bothside': 'B/S',
    'oneside': 'O/S',
    'frontback': 'Frontback',
    'doublegripper': 'D/G',
    'selfback': 'Selfback'
  };

  const createFormsData = (forms) => {
    return forms.map(process => {
      const qty = parseInt(process.qty || 0);
      const extra = parseInt(process.extraSheets || 0);
      const totalSheets = qty + extra;
      const printingTypeString = (process.forms || 'N/A').toLowerCase();
      const abbreviatedType = printingTypeMap[printingTypeString] || process.forms;
      const formCount = process.sideCount || 'N/A';
      
      const combinedPrintingType = `${abbreviatedType} x ${formCount}`;

      return [
        combinedPrintingType,
        totalSheets.toString(),
        process.machine || 'N/A',
        '' // Empty cell for SIGN
      ];
    });
  };
  
  const innerFormsData = createFormsData(innerForms);
  const coverFormsData = createFormsData(coverForms);
  
  const innerPrintingData = [
    ['PRINTING', 'SHEET', 'Machine', 'AMT'],
    ...innerFormsData
  ];

  const coverPrintingData = [
    ['PRINTING', 'SHEET', 'Machine', 'AMT'],
    ...coverFormsData
  ];

  // Inner Printing Table
  doc.autoTable({
    body: innerPrintingData,
    startY: printingTablesStartY,
    margin: { left: 5 },
    tableWidth: 95,
    theme: 'grid',
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: 0,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 20 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 }
    },
    styles: {
      fontSize: 10,
      cellPadding: 2,
      textColor: [0, 0, 0]
    }
  });

  // Cover Printing Table - only show if cover forms exist
  if (coverForms.length > 0) {
    doc.autoTable({
      body: coverPrintingData,
      startY: printingTablesStartY,
      margin: { left: 110 },
      tableWidth: 95,
      theme: 'grid',
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: 0,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 }
      },
      styles: {
        fontSize: 10,
        cellPadding: 2,
        textColor: [0, 0, 0]
      }
    });
  }

  // --- LAMINATION AND ADDITIONAL PROCESSES ---
  const processesStartY = doc.autoTable.previous.finalY + 6;
  let leftColumnY = processesStartY;
  let rightColumnY = processesStartY;

  const processes = [];
  const inputs = quotationInputs;

  if (inputs.lamination && inputs.lamination !== 'none') {
    const laminationType = laminationTypes.find(lt => lt.laminationName === inputs.lamination);
    const laminationDisplay = laminationType ? `${inputs.lamination} - ₹${laminationType.rate}` : inputs.lamination;
    processes.push(['Lamination', laminationDisplay]);
  }
  if (inputs.coverLamination && inputs.coverLamination !== 'none') {
    const coverLaminationType = laminationTypes.find(lt => lt.laminationName === inputs.coverLamination);
    const coverLaminationDisplay = coverLaminationType ? `${inputs.coverLamination} - ₹${coverLaminationType.rate}` : inputs.coverLamination;
    processes.push(['Cover Lamination', coverLaminationDisplay]);
  }
  if (inputs.uvType && inputs.uvType !== 'none') processes.push(['UV Type', inputs.uvType]);
  if (inputs.foilingType && inputs.foilingType !== 'none') processes.push(['Foiling Type', inputs.foilingType]);
  if (inputs.dripUpType && inputs.dripUpType !== 'none') processes.push(['Drip Up Type', inputs.dripUpType]);
  if (inputs.additionalProcess && inputs.additionalProcess !== '0') processes.push(['External Pre', inputs.additionalProcess]);
  if (inputs.additionalProcess2 && inputs.additionalProcess2 !== '0') processes.push(['External Pre 2', inputs.additionalProcess2]);
  if (inputs.punching === 'yes') processes.push(['Punching', 'Yes']);
  if (inputs.dieType && inputs.dieType !== '0') {
    const dieValue = firstResult.dieTypeText || inputs.dieType;
    processes.push(['External (Die)', dieValue]);
  }
  const jobCardProcessDetails = jobCard.processDetails || [];
  const bindingValues = [...new Set(jobCardProcessDetails.map(p => p.binding).filter(b => b))];

  if (bindingValues.length > 0) {
    bindingValues.forEach((binding, index) => {
      const label = index === 0 ? 'Binding' : `Binding ${index + 1}`;
      processes.push([label, binding]);
    });
  } else {
    // Fallback to quotation inputs if no binding info in process details
    if (inputs.fabrication && inputs.fabrication !== '0') processes.push(['Binding', inputs.fabrication]);
    if (inputs.fabricationN && inputs.fabricationN !== '0') processes.push(['Binding 2', inputs.fabricationN]);
  }

  if (processes.length > 0) {
    const tableOptions = {
      theme: 'grid',
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 35 },
        1: { cellWidth: 40 },
        2: { fontStyle: 'bold', cellWidth: 15 },
        3: { cellWidth: 20 }
      },
      styles: {
        fontSize: 10,
        cellPadding: 2,
        textColor: [0, 0, 0]
      }
    };

    processes.forEach((process) => {
      const [label, value] = process;
      const processRow = [label, value, '', ''];
      
      if (leftColumnY <= rightColumnY) {
        doc.autoTable({
          ...tableOptions,
          body: [processRow],
          startY: leftColumnY,
          margin: { left: 5 },
          tableWidth: 95,
        });
        leftColumnY = doc.autoTable.previous.finalY + 2;
      } else {
        doc.autoTable({
          ...tableOptions,
          body: [processRow],
          startY: rightColumnY,
          margin: { left: 110 },
          tableWidth: 95,
        });
        rightColumnY = doc.autoTable.previous.finalY + 2;
      }
    });
  }

  doc.output('dataurlnewwindow');
};

export { generatePdf };
