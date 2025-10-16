// Inicialización del SignaturePad
const canvas = document.getElementById('signature-pad');
const signaturePad = new SignaturePad(canvas, {
    minWidth: 0.5,
    maxWidth: 1.5,
    penColor: 'rgb(0,0,0)'
});

// Variables para fotos
let selectedPhotos = [];
const photoPreviews = document.getElementById('photo-previews');

// Ajustar el tamaño del canvas para que coincida con el CSS
function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    signaturePad.clear(); // Limpiar después de redimensionar
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Función para convertir imagen a base64
function getBase64Image(imgUrl) {
    return fetch(imgUrl)
        .then(response => response.blob())
        .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        }));
}

// Función para manejar el botón Limpiar
function clearSignature() {
    signaturePad.clear();
}

// Función para obtener la orientación EXIF de una imagen
function getImageOrientation(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const view = new DataView(e.target.result);
            if (view.getUint16(0, false) != 0xFFD8) {
                resolve(1); // No es JPEG
                return;
            }
            const length = view.byteLength;
            let offset = 2;
            while (offset < length) {
                if (view.getUint16(offset+2, false) <= 8) break;
                const marker = view.getUint16(offset, false);
                offset += 2;
                if (marker == 0xFFE1) {
                    if (view.getUint32(offset += 2, false) != 0x45786966) break;
                    const little = view.getUint16(offset += 6, false) == 0x4949;
                    offset += view.getUint32(offset + 4, little);
                    const tags = view.getUint16(offset, little);
                    offset += 2;
                    for (let i = 0; i < tags; i++) {
                        if (view.getUint16(offset + (i * 12), little) == 0x0112) {
                            resolve(view.getUint16(offset + (i * 12) + 8, little));
                            return;
                        }
                    }
                } else if ((marker & 0xFF00) != 0xFF00) break;
                else offset += view.getUint16(offset, false);
            }
            resolve(1); // Orientación por defecto
        };
        reader.readAsArrayBuffer(file);
    });
}

// Función para corregir la orientación de la imagen
function correctImageOrientation(img, orientation) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const { width, height } = img;

    // Ajustar canvas según orientación
    switch (orientation) {
        case 3: // 180 grados
        case 4:
            canvas.width = width;
            canvas.height = height;
            ctx.translate(width, height);
            ctx.rotate(Math.PI);
            break;
        case 5: // 90 grados CW + flip
        case 6: // 90 grados CW
        case 7: // 90 grados CW + flip
        case 8: // 90 grados CCW
            canvas.width = height;
            canvas.height = width;
            switch (orientation) {
                case 5:
                    ctx.translate(height, 0);
                    ctx.rotate(Math.PI / 2);
                    ctx.scale(-1, 1);
                    break;
                case 6:
                    ctx.translate(height, 0);
                    ctx.rotate(Math.PI / 2);
                    break;
                case 7:
                    ctx.translate(0, width);
                    ctx.rotate(-Math.PI / 2);
                    ctx.scale(-1, 1);
                    break;
                case 8:
                    ctx.translate(0, width);
                    ctx.rotate(-Math.PI / 2);
                    break;
            }
            break;
        default:
            canvas.width = width;
            canvas.height = height;
    }

    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg');
}

// Función para manejar selección de fotos
async function handlePhotoSelection(event) {
    const files = Array.from(event.target.files);
    selectedPhotos = [];
    photoPreviews.innerHTML = '';

    const promises = files.map(async (file) => {
        if (file.type.startsWith('image/')) {
            const orientation = await getImageOrientation(file);
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = function() {
                    const correctedDataURL = correctImageOrientation(img, orientation);
                    resolve(correctedDataURL);
                };
                img.src = URL.createObjectURL(file);
            });
        }
    });

    selectedPhotos = await Promise.all(promises.filter(p => p)); // Filter out undefined for non-image files

    // Crear previews después de cargar todas las imágenes
    updatePreviews();
}

// Función para actualizar previews después de eliminar
function updatePreviews() {
    photoPreviews.innerHTML = '';
    selectedPhotos.forEach((dataURL, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'me-2 mb-2';
        previewDiv.innerHTML = `
            <img src="${dataURL}" class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
            <button class="btn btn-sm btn-danger mt-1 remove-photo" data-index="${index}">Eliminar</button>
        `;
        photoPreviews.appendChild(previewDiv);

        previewDiv.querySelector('.remove-photo').addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-index'));
            selectedPhotos.splice(idx, 1);
            updatePreviews();
        });
    });
}

// Función para manejar el botón Descargar PDF
async function downloadPDF() {
    if (signaturePad.isEmpty()) {
        alert('Por favor, firma antes de descargar el PDF.');
        return;
    }

    const name = document.getElementById('name').value.trim();
    if (!name) {
        alert('Por favor, ingresa tu nombre.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm' }); // Usar mm para consistencia

    try {
        const reportImageData = await getBase64Image('reporte.jpg');

        // Agregar la imagen del reporte al PDF (tamaño A4 en mm)
        pdf.addImage(reportImageData, 'JPEG', 0, 0, 210, 297);

        // Agregar el nombre en la posición del campo nombre (ajustar coordenadas según la imagen)
        pdf.setFontSize(12);
        pdf.text(name, 60, 67); // Ajustar x=60, y=67 según la posición del campo nombre en la imagen

        // Agregar la firma como imagen superpuesta justo arriba de la línea de FIRMA DECLARANTE
        const signatureData = signaturePad.toDataURL('image/png');
        pdf.addImage(signatureData, 'PNG', 20, 225, 80, 20); // Ajustado: x=20, y=225, ancho=80, alto=20

        // Agregar fotos en nuevas páginas si hay fotos seleccionadas
        if (selectedPhotos.length > 0) {
            const evidenciaImage = await getBase64Image('reporteevidencia.jpg');
            const imagesPerPage = 4;
            const marginTop = 30;
            const marginBottom = 20;
            const marginLeft = 20;
            const marginRight = 20;
            const pageWidth = 210;
            const pageHeight = 297;
            const usableWidth = pageWidth - marginLeft - marginRight;
            const usableHeight = pageHeight - marginTop - marginBottom;

            for (let i = 0; i < selectedPhotos.length; i += imagesPerPage) {
                pdf.addPage();
                pdf.addImage(evidenciaImage, 'JPEG', 0, 0, pageWidth, pageHeight);
                const numPhotos = Math.min(imagesPerPage, selectedPhotos.length - i);
                if (numPhotos === 1) {
                    // Una foto ocupa tamaño grande centrado
                    const imgWidth = 120;
                    const imgHeight = 80;
                    const startX = marginLeft + (usableWidth - imgWidth) / 2;
                    const startY = marginTop + (usableHeight - imgHeight) / 2;
                    pdf.addImage(selectedPhotos[i], 'JPEG', startX, startY, imgWidth, imgHeight);
                } else if (numPhotos === 2) {
                    // Dos fotos en formato de grid horizontal
                    const cols = 2;
                    const rows = 1;
                    const cellWidth = 80;
                    const cellHeight = 60;
                    const totalGridWidth = cols * cellWidth;
                    const totalGridHeight = rows * cellHeight;
                    const startX = marginLeft + (usableWidth - totalGridWidth) / 2;
                    const startY = marginTop + (usableHeight - totalGridHeight) / 2;
                    for (let j = 0; j < numPhotos; j++) {
                        const imgData = selectedPhotos[i + j];
                        const x = startX + (j % cols) * cellWidth;
                        const y = startY + Math.floor(j / cols) * cellHeight;
                        pdf.addImage(imgData, 'JPEG', x, y, cellWidth, cellHeight);
                    }
                } else {
                    // Tres o cuatro fotos en grid de 2x2 con tamaño reducido
                    const cols = 2;
                    const rows = 2;
                    const cellWidth = 60;
                    const cellHeight = 40;
                    const totalGridWidth = cols * cellWidth;
                    const totalGridHeight = rows * cellHeight;
                    const startX = marginLeft + (usableWidth - totalGridWidth) / 2;
                    const startY = marginTop + (usableHeight - totalGridHeight) / 2;
                    for (let j = 0; j < numPhotos; j++) {
                        const imgData = selectedPhotos[i + j];
                        const x = startX + (j % cols) * cellWidth;
                        const y = startY + Math.floor(j / cols) * cellHeight;
                        pdf.addImage(imgData, 'JPEG', x, y, cellWidth, cellHeight);
                    }
                }
            }
        }

        // Descargar el PDF
        pdf.save('reporte_con_firma.pdf');
    } catch (error) {
        alert('Error al cargar la imagen del reporte: ' + error.message);
    }
}

// Event listeners
document.getElementById('clear').addEventListener('click', clearSignature);
document.getElementById('download-pdf').addEventListener('click', downloadPDF);
document.getElementById('fotos').addEventListener('change', handlePhotoSelection);
