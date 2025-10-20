// Inicialización del SignaturePad
const canvas = document.getElementById('signature-pad');
const signaturePad = new SignaturePad(canvas, {
    minWidth: 0.5,
    maxWidth: 1.5,
    penColor: 'rgb(0,0,0)'
});

// Set default date to today
document.getElementById('datetime').value = new Date().toISOString().slice(0, 10);

// Variables para fotos
let selectedPhotos = []; // Ahora será array de objetos {dataURL, width, height}
const photoPreviews = document.getElementById('photo-previews');

// Ajustar el tamaño del canvas para que coincida con el CSS
function resizeCanvas() {
    const data = signaturePad.toData(); // Guardar datos de la firma antes de redimensionar
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    signaturePad.clear(); // Limpiar después de redimensionar
    if (data.length > 0) {
        signaturePad.fromData(data); // Restaurar datos de la firma si existían
    }
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
        reader.onload = function (e) {
            const view = new DataView(e.target.result);
            if (view.getUint16(0, false) != 0xFFD8) {
                resolve(1); // No es JPEG
                return;
            }
            const length = view.byteLength;
            let offset = 2;
            while (offset < length) {
                if (view.getUint16(offset + 2, false) <= 8) break;
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

// Función para girar imagen 90 grados en sentido horario
function rotateImage(dataURL) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.height;
            canvas.height = img.width;
            ctx.translate(img.height, 0);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = function () {
            reject(new Error('Failed to load image for rotating'));
        };
        img.src = dataURL;
    });
}

// Función para manejar selección de fotos
async function handlePhotoSelection(event) {
    const files = Array.from(event.target.files);
    selectedPhotos = [];
    photoPreviews.innerHTML = '';

    const promises = files.map(async (file) => {
        if (file.type.startsWith('image/')) {
            try {
                const orientation = await getImageOrientation(file);
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = function () {
                        const correctedDataURL = correctImageOrientation(img, orientation);
                        resolve({ dataURL: correctedDataURL, width: img.width, height: img.height });
                    };
                    img.onerror = function () {
                        console.error('Error loading image:', file.name);
                        // Fallback: use original file as dataURL and get dimensions
                        const reader = new FileReader();
                        reader.onload = () => {
                            const fallbackImg = new Image();
                            fallbackImg.onload = () => {
                                resolve({ dataURL: reader.result, width: fallbackImg.width, height: fallbackImg.height });
                            };
                            fallbackImg.src = reader.result;
                        };
                        reader.readAsDataURL(file);
                    };
                    img.src = URL.createObjectURL(file);
                });
            } catch (error) {
                console.error('Error processing file:', file.name, error);
                // Fallback: use original file as dataURL and get dimensions
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const fallbackImg = new Image();
                        fallbackImg.onload = () => {
                            resolve({ dataURL: reader.result, width: fallbackImg.width, height: fallbackImg.height });
                        };
                        fallbackImg.src = reader.result;
                    };
                    reader.readAsDataURL(file);
                });
            }
        }
    });

    selectedPhotos = await Promise.all(promises.filter(p => p)); // Filter out undefined for non-image files

    // Crear previews después de cargar todas las imágenes
    updatePreviews();
}

// Función para actualizar previews después de eliminar
function updatePreviews() {
    photoPreviews.innerHTML = '';
    selectedPhotos.forEach((photo, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'me-2 mb-2';
        previewDiv.innerHTML = `
            <img src="${photo.dataURL}" class="img-thumbnail" style="width: 100px; height: 100px; object-fit: cover;">
            <button type="button" class="btn btn-sm btn-danger mt-1 remove-photo" data-index="${index}">Eliminar</button>
            <button type="button" class="btn btn-sm btn-warning mt-1 flip-photo" data-index="${index}">Girar</button>
        `;
        photoPreviews.appendChild(previewDiv);

        previewDiv.querySelector('.remove-photo').addEventListener('click', function () {
            const idx = parseInt(this.getAttribute('data-index'));
            selectedPhotos.splice(idx, 1);
            updatePreviews();
        });

        previewDiv.querySelector('.flip-photo').addEventListener('click', async function () {
            const idx = parseInt(this.getAttribute('data-index'));
            try {
                const rotated = await rotateImage(selectedPhotos[idx].dataURL);
                // Después de rotar, necesitamos recalcular width y height
                const img = new Image();
                img.onload = () => {
                    selectedPhotos[idx] = { dataURL: rotated, width: img.height, height: img.width }; // Rotar intercambia width y height
                    updatePreviews();
                };
                img.src = rotated;
            } catch (error) {
                console.error('Error flipping image:', error);
            }
        });
    });
}

// Función para manejar el botón Descargar PDF
async function downloadPDF() {
    const name = document.getElementById('name').value.trim();

    const rut = document.getElementById('rut').value.trim();

    const area = document.getElementById('area').value.trim();

    const sede = document.getElementById('sede').value.trim();

    const datetime = document.getElementById('datetime').value;

    const tipoIncidente = document.querySelector('input[name="tipoIncidente"]:checked');

    // Validación para radio button obligatorio
    if (!tipoIncidente) {
        alert('Es obligatorio marcar el tipo de incidente.');
        return;
    }

    const descripcion = document.getElementById('descripcion').value.trim();

    const tipo = document.getElementById('tipo').value.trim();

    const ubicacion = document.getElementById('ubicacion').value.trim();

    const dia = document.getElementById('dia').value.trim();

    const horario = document.getElementById('horario').value.trim();

    const patente = document.getElementById('patente').value.trim();

    const declarante = document.getElementById('declarante').value.trim();

    const supervisor = document.getElementById('supervisor').value.trim();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm' }); // Usar mm para consistencia

    try {
        const reportImageData = await getBase64Image('reporte.jpg');

        // Agregar la imagen del reporte al PDF (tamaño A4 en mm)
        pdf.addImage(reportImageData, 'JPEG', 0, 0, 210, 297);

        pdf.setFontSize(12);
        pdf.text(name, 60, 67.9);

        pdf.text(rut, 60, 73.4);

        pdf.text(area, 60, 79);

        pdf.text(sede, 60, 84.6);

        pdf.text(tipo, 60, 120.5);

        pdf.text(ubicacion, 60, 128.5);

        pdf.text(dia, 60, 136.5);

        pdf.text(horario, 60, 145);

        pdf.text(patente, 147, 120.5);

        pdf.text(declarante, 45, 258.5)

        pdf.text(supervisor, 130, 258.5)

        // Add date to PDF in dd-mm-yyyy format
        const [year, month, day] = datetime.split('-');
        const formattedDate = `${day}-${month}-${year}`;
        pdf.text(formattedDate, 142, 59);

        // Add radio button selection to PDF
        if (tipoIncidente.value === '0') {
            pdf.text('X', 150, 72.5); // Position for value 0, a bit higher
        } else if (tipoIncidente.value === '1') {
            pdf.text('X', 150, 78); // Position for value 1, a bit lower
        }

        // Add description to PDF with automatic text wrapping
        if (descripcion) {
            const maxWidth = 160;
            const lines = pdf.splitTextToSize(descripcion, maxWidth);
            // Define y positions for each of the 11 lines
            const yPositions = [164, 170, 175, 181, 186, 192, 197, 203, 208, 214, 220];
            for (let i = 0; i < lines.length && i < yPositions.length; i++) {
                pdf.text(lines[i], 30, yPositions[i]);
            }
        }

        // Agregar la firma como imagen superpuesta justo arriba de la línea de FIRMA DECLARANTE solo si no está vacía
        if (!signaturePad.isEmpty()) {
            const signatureData = signaturePad.toDataURL('image/png');
            pdf.addImage(signatureData, 'PNG', 20, 225, 80, 20); // Ajustado: x=20, y=225, ancho=80, alto=20
        }

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
                    // Una foto ocupa tamaño grande centrado, maximizado aprovechando toda la hoja
                    const imgWidth = 170;
                    const imgHeight = 220;
                    const startX = marginLeft + (usableWidth - imgWidth) / 2;
                    const startY = marginTop + (usableHeight - imgHeight) / 2;
                    pdf.addImage(selectedPhotos[i].dataURL, 'JPEG', startX, startY, imgWidth, imgHeight);
                } else if (numPhotos === 2) {
                    // Dos fotos en formato de grid vertical, escaladas proporcionalmente para no estirar y aprovechar más espacio
                    const cols = 1;
                    const rows = 2;
                    const cellWidth = 170;
                    const cellHeight = 110;
                    const totalGridWidth = cols * cellWidth;
                    const totalGridHeight = rows * cellHeight;
                    const startX = marginLeft + (usableWidth - totalGridWidth) / 2;
                    const startY = marginTop + (usableHeight - totalGridHeight) / 2;
                    for (let j = 0; j < numPhotos; j++) {
                        const photo = selectedPhotos[i + j];
                        const scale = Math.min(cellWidth / photo.width, cellHeight / photo.height);
                        const actualWidth = photo.width * scale;
                        const actualHeight = photo.height * scale;
                        const x = startX + (j % cols) * cellWidth + (cellWidth - actualWidth) / 2;
                        const y = startY + Math.floor(j / cols) * cellHeight + (cellHeight - actualHeight) / 2;
                        pdf.addImage(photo.dataURL, 'JPEG', x, y, actualWidth, actualHeight);
                    }
                } else {
                    // Tres o cuatro fotos en grid de 2x2, escaladas proporcionalmente para no estirar
                    const cols = 2;
                    const rows = 2;
                    const cellWidth = 85;
                    const cellHeight = 100;
                    const totalGridWidth = cols * cellWidth;
                    const totalGridHeight = rows * cellHeight;
                    const startX = marginLeft + (usableWidth - totalGridWidth) / 2;
                    const startY = marginTop + (usableHeight - totalGridHeight) / 2;
                    for (let j = 0; j < numPhotos; j++) {
                        const photo = selectedPhotos[i + j];
                        const scale = Math.min(cellWidth / photo.width, cellHeight / photo.height);
                        const actualWidth = photo.width * scale;
                        const actualHeight = photo.height * scale;
                        const x = startX + (j % cols) * cellWidth + (cellWidth - actualWidth) / 2;
                        const y = startY + Math.floor(j / cols) * cellHeight + (cellHeight - actualHeight) / 2;
                        pdf.addImage(photo.dataURL, 'JPEG', x, y, actualWidth, actualHeight);
                    }
                }
            }
        }

        // Descargar el PDF
        pdf.save('reporte_incidenteS.pdf');
    } catch (error) {
        alert('Error al cargar la imagen del reporte: ' + error.message);
    }
}

// Event listeners
document.getElementById('clear').addEventListener('click', clearSignature);
document.getElementById('download-pdf').addEventListener('click', downloadPDF);
document.getElementById('fotos').addEventListener('change', handlePhotoSelection);