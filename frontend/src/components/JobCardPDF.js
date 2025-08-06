import jsPDF from 'jspdf';
import 'jspdf-autotable';

const generatePdf = (jobCard) => {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Add header
  doc.setFontSize(20);
  doc.text('Job Card', 148, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Job Card #: ${jobCard.jobCardNum}`, 14, 30);
  doc.text(`Date: ${new Date(jobCard.createdAt).toLocaleDateString()}`, 282, 30, { align: 'right' });

  // Customer and Job Details
  const customerDetails = [
    ['Customer Name', jobCard.customerName || 'N/A'],
    ['Job Name', jobCard.jobName || 'N/A'],
    ['Product Name', jobCard.productName || 'N/A'],
    ['Quotation #', jobCard.quotationNumber || 'N/A'],
    ['PO #', jobCard.poNumber || 'N/A'],
    ['Priority', jobCard.priority ? jobCard.priority.replace('_', ' ') : 'N/A'],
  ];

  doc.autoTable({
    startY: 40,
    head: [['Customer & Job Details', '']],
    body: customerDetails,
    theme: 'grid',
    headStyles: { fillColor: [22, 160, 133] },
  });

  // Paper Details
  const paperDetails = [
    ['Paper Type', jobCard.paperType || 'N/A'],
    ['Paper GSM', jobCard.paperGsm || 'N/A'],
    ['Paper Size', `${jobCard.paperLength || 'N/A'} x ${jobCard.paperWidth || 'N/A'}`],
    ['Cut Size', jobCard.cutSize || 'N/A'],
    ['UPS', jobCard.ups || 'N/A'],
    ['Sheet Qty (Full/Cut)', `${jobCard.qtyFullSheet || 'N/A'} / ${jobCard.qtyCutSheet || 'N/A'}`],
    ['Paper By', jobCard.paperBy || 'N/A'],
  ];

  doc.autoTable({
    startY: doc.autoTable.previous.finalY + 10,
    head: [['Paper Details (Main)', '']],
    body: paperDetails,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
  });

  // Cover Paper Details (if applicable)
  if (jobCard.coverPaperType) {
    const coverPaperDetails = [
        ['Paper Type', jobCard.coverPaperType || 'N/A'],
        ['Paper GSM', jobCard.coverPaperGsm || 'N/A'],
        ['Paper Size', `${jobCard.coverPaperLength || 'N/A'} x ${jobCard.coverPaperWidth || 'N/A'}`],
        ['Cut Size', jobCard.coverCutSize || 'N/A'],
        ['UPS', jobCard.coverUps || 'N/A'],
        ['Sheet Qty (Full/Cut)', `${jobCard.coverQtyFullSheet || 'N/A'} / ${jobCard.coverQtyCutSheet || 'N/A'}`],
        ['Paper By', jobCard.coverPaperBy || 'N/A'],
    ];

    doc.autoTable({
        startY: doc.autoTable.previous.finalY + 10,
        head: [['Paper Details (Cover)', '']],
        body: coverPaperDetails,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
    });
  }

  // Process Details
  const processDetails = jobCard.processDetails || [];
  const processHead = [['Forms', 'Side #', 'Qty', 'Extra', 'Type', 'Machine', 'Lamination', 'Ext. Pre', 'Ext. Pre 2', 'Punching', 'External', 'Binding']];
  const processBody = processDetails.map(p => [
    p.forms || '',
    p.sideCount || '',
    p.qty || '',
    p.extraSheets || '',
    p.type || '',
    p.machine || '',
    p.lamination || '',
    p.externalPre || '',
    p.externalPre2 || '',
    p.punching || '',
    p.external || '',
    p.binding || ''
  ]);

  doc.autoTable({
    startY: doc.autoTable.previous.finalY + 10,
    head: processHead,
    body: processBody,
    theme: 'grid',
    headStyles: { fillColor: [243, 156, 18] },
    styles: { fontSize: 8, cellPadding: 1 },
    columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 15 },
        2: { cellWidth: 15 },
        3: { cellWidth: 15 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 },
        7: { cellWidth: 25 },
        8: { cellWidth: 25 },
        9: { cellWidth: 20 },
        10: { cellWidth: 20 },
        11: { cellWidth: 25 },
    }
  });

  // Other Details
  const otherDetails = [
    ['Job Color', jobCard.jobColor || 'N/A'],
    ['Plate By', jobCard.plateBy || 'N/A'],
    ['Job Type', jobCard.jobType || 'N/A'],
    ['Billing Type', jobCard.billingType || 'N/A'],
    ['Image Attached', jobCard.imageAttached ? 'Yes' : 'No'],
    ['Sample Attached', jobCard.sampleAttached || 'N/A'],
  ];

  doc.autoTable({
    startY: doc.autoTable.previous.finalY + 10,
    head: [['Other Details', '']],
    body: otherDetails,
    theme: 'grid',
    headStyles: { fillColor: [149, 165, 166] },
  });

  doc.output('dataurlnewwindow');
};

export { generatePdf };