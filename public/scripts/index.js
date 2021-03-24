var pdfjsLib = window['pdfjs-dist/build/pdf'];
const { PDFDocument } = PDFLib;

const docScale = 2.0;

let pdfDat = null;
let currentMode = "";

let fCanvasItems = [];

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

            fCanvasItems = new Array(numPages);

            for (let k = 1; k < numPages + 1; k++) {
                pdf.getPage(k).then(function(page) {
                    console.log(`Page ${k} loaded`);

                    var viewport = page.getViewport({scale: docScale});

                    // Prepare canvas using PDF page dimensions
                    const canvasId = "canvas-" + k;
                    $('div.canvas').append(`<div class="canvas-item" data-page-num="${k}"><canvas id="${canvasId}" class="canvas-page"></canvas></div>`);
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

                        const dat = canvas.toDataURL('image/jpeg');
                        const fCanvas = new fabric.Canvas(canvasId);
                        fCanvasItems[k - 1] = fCanvas;

                        fCanvas.selection = false; // disable group selection

                        // $('#' + canvasId).append(`<img src=${dat} class="doc-img" />`)
                        // const $img = $('#' + canvasId + ' > img.doc-img').first();
                        // const imgElem = new fabric.Image($img[0], {
                        //     left: 0,
                        //     top: 0,
                        //     height: fCanvas.height,
                        //     width: fCanvas.width,
                        // });
                        // fCanvas.add(imgElem);
                        fCanvas.setBackgroundImage(dat, fCanvas.renderAll.bind(fCanvas), {
                            // should the image be resized to fit the container?
                            backgroundImageStretch: false
                        });
                    });
                });
            }
        });
    };
    //Step 3:Read the file as ArrayBuffer
    fileReader.readAsArrayBuffer(file);
});

$(document).on('click', 'canvas.canvas-page', (event) => {
    if (currentMode === "text") {
        const $elem = $(event.target);
        const fCanvas = fCanvasItems[$elem.parent().parent().data('page-num') - 1];

        const offset = $elem.offset();
        const left = (event.pageX - offset.left);
        const top = (event.pageY - offset.top);

        var text = new fabric.Text('Lorem Ipsum', { left: left, top: top});
        fCanvas.add(text);
        currentMode = "";
    }
});

$(document).on('click', '#btnAddTextField', () => {
    currentMode = "text";
});

$(document).on('click', '#btnDownload', async (event) => {
    const pdfDoc = await PDFDocument.create();

    for (let k = 0; k < fCanvasItems.length; k++) {
        $elem = $(`#canvas-${k + 1}`);
        const jpgImageBytes = await fetch($elem[0].toDataURL('image/jpeg')).then((res) => res.arrayBuffer());
        const jpgImage = await pdfDoc.embedJpg(jpgImageBytes);

        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        page.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: width,
            height: height,
        });
    }

    const pdfBytes = await pdfDoc.save();
    download(pdfBytes, "download.pdf", "application/pdf");
});
