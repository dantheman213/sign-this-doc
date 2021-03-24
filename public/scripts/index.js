var pdfjsLib = window['pdfjs-dist/build/pdf'];
const { PDFDocument } = PDFLib;

const docScale = 2.0;

let pdfDat = null;
let currentMode = "text";


$(document).on('change', '#txtFile', (event) => {
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        alert('The File APIs are not fully supported in this browser.');
        return;
    }

    var file = event.target.files[0];

    //Step 2: Read the file using file reader
    var fileReader = new FileReader();

    fileReader.onload = function() {
        //Step 4:turn array buffer into typed array
        pdfDat = new Uint8Array(this.result);

        //Step 5:PDFJS should be able to read this
        var loadingTask = pdfjsLib.getDocument(pdfDat);

        loadingTask.promise.then(function(pdf) {
            console.log('PDF loaded');
            var numPages = pdf.numPages;

            for (let k = 1; k < numPages + 1; k++) {
                pdf.getPage(k).then(function(page) {
                    console.log(`Page ${k} loaded`);

                    var viewport = page.getViewport({scale: docScale});

                    // Prepare canvas using PDF page dimensions
                    const canvasId = "canvas-" + k;
                    $('div.canvas').append(`<div class="canvas-item" data-page-num="${k}"><canvas id="${canvasId}"></canvas></div>`);
                    var canvas = document.getElementById(canvasId);
                    var context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    // Render PDF page into canvas context
                    var renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };
                    var renderTask = page.render(renderContext);
                    renderTask.promise.then(function () {
                        console.log('Page rendered');
                    });
                });
            }
        });
    };
    //Step 3:Read the file as ArrayBuffer
    fileReader.readAsArrayBuffer(file);
});

$(document).on('click', 'div.canvas-item', (event) => {
    const $elem = $(event.target);

    const offset = $elem.offset();
    const left = (event.pageX - offset.left);
    const top = (event.pageY);// - offset.top);

    if (currentMode === 'text') {
        $elem.parent().append(`<div class="text" style="top: ${top}px; left: ${left}px;">Lorem Ipsum</div>`);
    }
});

$(document).on('click', '#btnDownload', async (event) => {
    const pdfDoc = await PDFDocument.load(pdfDat);

    const pages = pdfDoc.getPages();

    for (let k = 0; k < pages.length; k++) {
        const page = pages[k];
        const { width, height } = page.getSize();
        const cropBox = page.getCropBox();

        $(`div.canvas-item[data-page-num='${k + 1}'] > div.text`).each((index, elem) => {
            const $elem = $(elem);
            page.drawText($elem.text(), {
                x: $elem.position().left / docScale,
                //y: 690,
                y: height - ($elem.position().top / 2) - cropBox.height/2,
                size: 12,
            });
        });
    }

    const pdfBytes = await pdfDoc.save();
    download(pdfBytes, "download.pdf", "application/pdf");
});
