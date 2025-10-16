function loadImage(url) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = "blob";
        xhr.onload = function (e) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const res = event.target.result;
                resolve(res);
            }
            const file = this.response;
            reader.readAsDataURL(file);
        }
        xhr.send();
    });
}


let signaturepad = null;

window.addEventListener('load', async () => {

    const canvas = document.querySelector("canvas");
    canvas.height = canvas.offsetHeight;
    canvas.width = canvas.offsetWidth;

    signaturepad = new SignaturePad(canvas, {});

    const form = document.querySelector('#form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let nombre = document.getElementById('nombre').value;
        let rut = document.getElementById('rut').value;
        let area = document.getElementById('area').value;
        let sede = document.getElementById('sede').value;
        let evento = document.querySelector('input[name="evento"]:checked').value;
        let tipo = document.getElementById('tipo').value;
        let ubicacion = document.getElementById('ubicacion').value;
        let dia = document.getElementById('dia').value;
        let horario = document.getElementById('horario').value;
        let patente = document.getElementById('patente').value;
        let fecha = document.getElementById('fecha').value;
        let descripcion = document.getElementById('descripcion').value;
        let fotos = document.getElementById('fotos').files;
        let declarante = document.getElementById('declarante').value;
        let supervisor = document.getElementById('supervisor').value;

        generatePDF(nombre, fecha, rut, area, sede, evento, tipo, ubicacion, dia, horario, patente, fecha, descripcion, fotos, declarante, supervisor);
    })
});

async function generatePDF(nombre, fecha, rut, area, sede, evento, tipo, ubicacion, dia, horario, patente, fecha, descripcion, fotos, declarante, supervisor) {
    if (descripcion.length > 800) {
        alert('La descripción no puede exceder los 800 caracteres.');
        return;
    }

    const image = await loadImage('reporte.jpg');
    const evidenciaImage = await loadImage('reporteevidencia.jpg');
    const signatureImage = signaturepad.toDataURL();

    const pdf = new jsPDF('p', 'pt', 'letter');

    pdf.addImage(image, 'PNG', 0, 0, 565, 792);
    pdf.addImage(signatureImage, 'PNG', 100, 610, 120, 50);
    
    pdf.setFontSize(11);
    pdf.text(nombre, 160, 180);

    pdf.setFontSize(11);
    pdf.text(rut, 160, 195);

    pdf.setFontSize(11);
    pdf.text(area, 160, 210);


    pdf.setFontSize(11);
    pdf.text(sede, 160, 225);
    

    pdf.setFontSize(11);
    pdf.text(tipo, 160, 320);


    pdf.setFontSize(11);
    pdf.text(ubicacion, 160, 342);

    pdf.setFontSize(11);
    pdf.text(dia, 160, 364);

    pdf.setFontSize(11);
    pdf.text(horario, 160, 385);

    pdf.setFontSize(11);
    pdf.text(patente, 392, 320);

    pdf.setFontSize(11);
    pdf.text(declarante, 126, 689);

    pdf.setFontSize(11);
    pdf.text(supervisor, 356, 689);

    // Fecha escrita manualmente
    // pdf.text(fecha, 382, 158);
    

    
    const date = new Date();
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    pdf.text(formattedDate, 382, 158);


    pdf.setFillColor(0, 0, 0);

    if(parseInt(evento) === 0){
        pdf.text(403, 193, 'X');

    }else{
        pdf.text(404, 208, 'X');

    }

    const maxWidth = 435;
    const lineHeight = 15;
    const lines = pdf.splitTextToSize(descripcion, maxWidth);
    for (let i = 0; i < lines.length; i++) {
        pdf.text(lines[i], 80, 438 + i * lineHeight);
    }

    // Agregar fotos en nuevas páginas con fondo reporteevidencia.jpg
    const photoPromises = [];
    for (let i = 0; i < fotos.length; i++) {
        const file = fotos[i];
        const promise = new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                resolve(event.target.result);
            };
            reader.readAsDataURL(file);
        });
        photoPromises.push(promise);
    }

    const photoDataURLs = await Promise.all(photoPromises);
    const imagesPerPage = 4;
    const marginTop = 120;
    const marginBottom = 50;
    const marginLeft = 60;
    const marginRight = 30;
    const pageWidth = 565;
    const pageHeight = 792;
    const usableWidth = pageWidth - marginLeft - marginRight;
    const usableHeight = pageHeight - marginTop - marginBottom;

    for (let i = 0; i < photoDataURLs.length; i += imagesPerPage) {
        pdf.addPage();
        pdf.addImage(evidenciaImage, 'PNG', 0, 0, pageWidth, pageHeight);
        const numPhotos = Math.min(imagesPerPage, photoDataURLs.length - i);
        if (numPhotos === 1) {
            // Una foto ocupa el máximo espacio
            pdf.addImage(photoDataURLs[i], 'JPEG', marginLeft, marginTop, usableWidth, usableHeight);
        } else {
            // Múltiples fotos en grid uniforme centrado (mismo formato para 2, 3, 4 fotos)
            const cols = 2; // Fijo a 2 columnas para uniformidad
            const rows = 2; // Fijo a 2 filas para formato de 3 o 4 fotos
            const cellWidth = usableWidth / cols;
            const cellHeight = usableHeight / rows;
            const totalGridWidth = cols * cellWidth;
            const totalGridHeight = rows * cellHeight;
            const startX = marginLeft + (usableWidth - totalGridWidth) / 2;
            const startY = marginTop + (usableHeight - totalGridHeight) / 2;
            for (let j = 0; j < numPhotos; j++) {
                const imgData = photoDataURLs[i + j];
                const x = startX + (j % cols) * cellWidth;
                const y = startY + Math.floor(j / cols) * cellHeight;
                pdf.addImage(imgData, 'JPEG', x, y, cellWidth, cellHeight);
            }
        }
    }

    pdf.save('example.pdf');
    
}