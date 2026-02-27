// ==========================================
// TICKET MANAGEMENT SYSTEM - Backend
// ==========================================
// Columnas Ticket:
// 1:ID_Ticket  2:Fecha_Apertura  3:Solicitante  4:Solicitado
// 5:Tipo_Tarea  6:Descripcion  7:Foto_Evidencia  8:PDF_Evidencia
// 9:Estado  10:Fecha_Estimada  11:Fecha_Cierre  12:Observacion
// ==========================================

var SS_ID = ''; // ID de la hoja de cálculo
var SHEET_TICKET = 'Ticket';
var SHEET_SOLICITANTES = 'Solicitantes';
var FOLDER_FOTOS = 'TicketEvidencias';

// ---- Web App Entry Point ----
function doGet() {
    return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('Sistema de Tickets')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---- Helpers ----
function getSpreadsheet() {
    return SpreadsheetApp.openById(SS_ID);
}

function getOrCreateFolder(folderName) {
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
        return folders.next();
    }
    return DriveApp.createFolder(folderName);
}

// ---- Login por DNI ----
function loginPorDNI(dni) {
    var sheet = getSpreadsheet().getSheetByName(SHEET_SOLICITANTES);
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (String(row[1]).trim() === String(dni).trim()) {
            if (String(row[3]).toUpperCase() !== 'ACTIVO') {
                return { success: false, message: 'Tu usuario está INACTIVO. Contacta al administrador.' };
            }
            return {
                success: true,
                usuario: {
                    nombre: row[0],
                    dni: String(row[1]),
                    area: row[2],
                    estado: row[3]
                }
            };
        }
    }
    return { success: false, message: 'DNI no encontrado en el sistema.' };
}

// ---- Solicitantes ----
function getSolicitantes() {
    var sheet = getSpreadsheet().getSheetByName(SHEET_SOLICITANTES);
    var data = sheet.getDataRange().getValues();
    var solicitantes = [];

    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (String(row[3]).toUpperCase() === 'ACTIVO') {
            solicitantes.push({
                nombre: row[0],
                dni: String(row[1]),
                area: row[2]
            });
        }
    }
    return solicitantes;
}

// ---- Crear Ticket ----
function crearTicket(data) {
    var sheet = getSpreadsheet().getSheetByName(SHEET_TICKET);
    var lastRow = sheet.getLastRow();

    var nuevoId = 1;
    if (lastRow > 1) {
        var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
            var id = parseInt(ids[i][0]);
            if (!isNaN(id) && id >= nuevoId) {
                nuevoId = id + 1;
            }
        }
    }

    // Subir foto si existe
    var fotoUrl = '';
    if (data.foto && data.fotoNombre) {
        fotoUrl = subirArchivo(data.foto, data.fotoNombre, 'image/png');
    }

    // Subir PDF si existe
    var pdfUrl = '';
    if (data.pdf && data.pdfNombre) {
        pdfUrl = subirArchivo(data.pdf, data.pdfNombre, 'application/pdf');
    }

    // Columnas: ID, Fecha_Apertura, Solicitante, Solicitado, Tipo_Tarea, Descripcion,
    //           Foto_Evidencia, PDF_Evidencia, Estado, Fecha_Estimada, Fecha_Cierre, Observacion
    var nuevaFila = [
        nuevoId,
        new Date(),
        data.solicitante,
        data.solicitado,
        data.tipoTarea,
        data.descripcion || '',
        fotoUrl,
        pdfUrl,
        'Pendiente',
        '',
        '',
        ''
    ];

    sheet.appendRow(nuevaFila);

    return {
        success: true,
        ticketId: nuevoId,
        message: 'Ticket #' + nuevoId + ' creado exitosamente'
    };
}

// ---- Subir Archivo a Drive ----
function subirArchivo(base64Data, filename, mimeType) {
    try {
        var folder = getOrCreateFolder(FOLDER_FOTOS);
        var decoded = Utilities.base64Decode(base64Data);
        var blob = Utilities.newBlob(decoded, mimeType, filename);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return file.getUrl();
    } catch (e) {
        Logger.log('Error subiendo archivo: ' + e.message);
        return '';
    }
}

// ---- Leer tickets ----
function leerTickets_() {
    var sheet = getSpreadsheet().getSheetByName(SHEET_TICKET);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    var tickets = [];

    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        tickets.push({
            idTicket: row[0],
            fechaApertura: row[1] ? Utilities.formatDate(new Date(row[1]), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm') : '',
            solicitante: row[2],
            solicitado: row[3],
            tipoTarea: row[4],
            descripcion: row[5] || '',
            fotoEvidencia: row[6],
            pdfEvidencia: row[7],
            estado: row[8],
            fechaEstimada: row[9] ? Utilities.formatDate(new Date(row[9]), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy') : '',
            fechaCierre: row[10] ? Utilities.formatDate(new Date(row[10]), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy') : '',
            observacion: row[11] || ''
        });
    }
    return tickets;
}

// ---- Tickets que YO creé ----
function getMisSolicitudes(nombreUsuario) {
    var todos = leerTickets_();
    return todos.filter(function (t) {
        return String(t.solicitante).toLowerCase() === String(nombreUsuario).toLowerCase();
    });
}

// ---- Tickets que ME asignaron ----
function getTicketsRecibidos(nombreUsuario) {
    var todos = leerTickets_();
    return todos.filter(function (t) {
        return String(t.solicitado).toLowerCase() === String(nombreUsuario).toLowerCase();
    });
}

// ---- Actualizar Ticket ----
function actualizarTicket(data) {
    var sheet = getSpreadsheet().getSheetByName(SHEET_TICKET);

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'No se encontraron tickets' };

    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var targetRow = -1;

    for (var i = 0; i < ids.length; i++) {
        if (parseInt(ids[i][0]) === parseInt(data.idTicket)) {
            targetRow = i + 2;
            break;
        }
    }

    if (targetRow === -1) {
        return { success: false, message: 'Ticket #' + data.idTicket + ' no encontrado' };
    }

    // Estado (col 9)
    if (data.estado) {
        sheet.getRange(targetRow, 9).setValue(data.estado);
    }

    // Fecha Estimada (col 10)
    if (data.fechaEstimada) {
        sheet.getRange(targetRow, 10).setValue(new Date(data.fechaEstimada));
    }

    // Fecha Cierre (col 11)
    if (data.fechaCierre) {
        sheet.getRange(targetRow, 11).setValue(new Date(data.fechaCierre));
    }

    // Observación (col 12)
    if (data.observacion !== undefined) {
        sheet.getRange(targetRow, 12).setValue(data.observacion);
    }

    return {
        success: true,
        message: 'Ticket #' + data.idTicket + ' actualizado exitosamente'
    };
}
