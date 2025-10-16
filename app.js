// Inicialización del SignaturePad
const canvas = document.getElementById('signature-pad');
const signaturePad = new SignaturePad(canvas, {
    minWidth: 1,
    maxWidth: 3,
    penColor: 'rgb(0,0,0)'
});

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
    const pdf = new jsPDF();

    // Cargar la imagen del reporte
    try {
        const reportImageData = await getBase64Image('reporte.jpg');

        // Agregar la imagen del reporte al PDF (tamaño A4 aproximado)
        pdf.addImage(reportImageData, 'JPEG', 0, 0, 210, 297); // A4 size in mm

        // Agregar el nombre en la posición del campo nombre (ajustar coordenadas según la imagen)
        pdf.setFontSize(12);
        pdf.text(name, 60, 67); // Ajustar x=20, y=50 según la posición del campo nombre en la imagen

        // Agregar la firma como imagen superpuesta justo arriba de la línea de FIRMA DECLARANTE
        const signatureData = signaturePad.toDataURL('image/png');
        pdf.addImage(signatureData, 'PNG', 20, 225, 80, 20); // Ajustado: x=20, y=230, ancho=80, alto=25

        // Descargar el PDF
        pdf.save('reporte_con_firma.pdf');
    } catch (error) {
        alert('Error al cargar la imagen del reporte: ' + error.message);
    }
}

// Event listeners
document.getElementById('clear').addEventListener('click', clearSignature);
document.getElementById('download-pdf').addEventListener('click', downloadPDF);
