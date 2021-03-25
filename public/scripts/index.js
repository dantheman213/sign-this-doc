var pdfjsLib = window['pdfjs-dist/build/pdf'];
const { PDFDocument } = PDFLib;

const docScale = 2.5;

let totalLoadedPage = 1;
let totalPageCount = 1;

let pdfDat = null;
let currentMode = "";
let signaturePad = null;

let currentSelectedfCanvas = null;
let fCanvasItems = [];
let signatureItems = [];
let currentSelectedSignature = null;

$(document).on('change', '#txtFile', (event) => {
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        alert('The File APIs are not fully supported in this browser.');
        return;
    }

    $('#uploadToast').toast('show');
    setTimeout(() => {
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
                totalPageCount = pdf.numPages;

                fCanvasItems = new Array(totalPageCount);

                for (let k = 1; k < totalPageCount + 1; k++) {
                    pdf.getPage(k).then(function(page) {
                        console.log(`Page ${k} loaded`);

                        // Prepare canvas using PDF page dimensions
                        const canvasId = "canvas-" + k;
                        $('div.canvas').append(`<div class="canvas-item" data-page-num="${k}"><canvas id="${canvasId}" class="canvas-page"></canvas></div>`);
                        const canvas = document.getElementById(canvasId);

                        const viewport = page.getViewport({scale: docScale});

                        const context = canvas.getContext('2d');
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
                            fCanvas.setBackgroundImage(dat, fCanvas.renderAll.bind(fCanvas), {
                                // should the image be resized to fit the container?
                                backgroundImageStretch: false
                            });

                            totalLoadedPage += 1;
                            if (totalLoadedPage >= totalPageCount) {
                                setTimeout(() => {
                                    $('#uploadToast').toast('hide');
                                    $("#toolbar").removeClass('hide');
                                }, 500);
                            }
                        });
                    });
                }
            });
        };

        //Step 3:Read the file as ArrayBuffer
        fileReader.readAsArrayBuffer(file);
    }, 500);
});

$(document).on('click', 'canvas.canvas-page', (event) => {
    const $elem = $(event.target);
    currentSelectedfCanvas = $elem.parent().parent().data('page-num') - 1;
    const fCanvas = fCanvasItems[currentSelectedfCanvas];

    const offset = $elem.offset();
    const left = (event.pageX - offset.left);
    const top = (event.pageY - offset.top);

    if (currentMode === "text") {
        const fontSize = parseInt($('#selectFontSize option:selected').text());
        const text = new fabric.Textbox('Text', { left: left, top: top, width: 150, fontSize: fontSize});
        fCanvas.add(text);
    } else if (currentMode === "signature") {
        if (currentSelectedSignature != null) {

            fabric.Image.fromURL(currentSelectedSignature, function(myImg) {
                const img1 = myImg.set({left: left, top: top});
                fCanvas.add(img1);
            });

            currentSelectedSignature = null;
        }
    }

    currentMode = "";
});

$(document).on('keydown', 'body', (event) => {
    const fCanvas = fCanvasItems[currentSelectedfCanvas];

    // when DELETE key is pressed
    if (event.keyCode === 46) {
        if (fCanvas.getActiveObject()) {
            //fCanvas.getActiveObject().remove();
            fCanvas.remove(fCanvas.getActiveObject());
        }
    }
});

$(document).on('click', '#btnAddTextField', () => {
    currentMode = "text";
});

$(document).on('click', '#btnCreateSignature', () => {
    const canvas = $('#signature')[0];
    signaturePad = new SignaturePad(canvas);
    $("#signatureModal").modal("show");
    //$('#frameSignature').removeClass('hide');
});

$(document).on('click', '#btnClearSignature', () => {
    signaturePad.clear();
});

$(document).on('click', '#btnSaveSignature', () => {
    if (!signaturePad.isEmpty()) {
        const svgDat = trimSignatureCanvas($('#signature')[0]);
        signatureItems.push(svgDat);
        $('#frameSignatureCollection').find('.card-body:first').append(`<button class="btn btn-outline-info"><img class="image-signature" src=${svgDat} width="150" /></button>`);

        $("#signatureModal").modal("hide");
        //$('#frameSignature').addClass('hide');
    }
});

$(document).on('click', 'img.image-signature', (event) => {
    const $img = $(event.target);
    currentSelectedSignature = $img.attr('src');
    currentMode = "signature";
});

$(document).on('click', '#btnDownload', async (event) => {
    $('#uploadToast').toast('show');

    setTimeout(async () => {
        const pdfDoc = await PDFDocument.create();

        for (let k = 0; k < fCanvasItems.length; k++) {
            fCanvasItems[k].discardActiveObject().renderAll();

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

        setTimeout(() => {
            $('#uploadToast').toast('hide');
        }, 500);
    }, 500);
});

function trimSignatureCanvas(canvas) {

    // First duplicate the canvas to not alter the original
    var croppedCanvas = document.createElement('canvas'),
        croppedCtx    = croppedCanvas.getContext('2d');

    croppedCanvas.width  = canvas.width;
    croppedCanvas.height = canvas.height;
    croppedCtx.drawImage(canvas, 0, 0);

    // Next do the actual cropping
    var w         = croppedCanvas.width,
        h         = croppedCanvas.height,
        pix       = {x:[], y:[]},
        imageData = croppedCtx.getImageData(0,0,croppedCanvas.width,croppedCanvas.height),
        x, y, index;

    for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
            index = (y * w + x) * 4;
            if (imageData.data[index+3] > 0) {
                pix.x.push(x);
                pix.y.push(y);

            }
        }
    }
    pix.x.sort(function(a,b){return a-b});
    pix.y.sort(function(a,b){return a-b});
    var n = pix.x.length-1;

    w = pix.x[n] - pix.x[0];
    h = pix.y[n] - pix.y[0];
    var cut = croppedCtx.getImageData(pix.x[0], pix.y[0], w, h);

    croppedCanvas.width = w;
    croppedCanvas.height = h;
    croppedCtx.putImageData(cut, 0, 0);

    return croppedCanvas.toDataURL("image/svg+xml");
}
