// Memoria Persistente mediante LocalStorage
let state = {
    buyers: {
        "Diego Suárez": { total: 9000000, paid: 0 },
        "Felipe Suárez": { total: 9000000, paid: 0 }
    },
    ledger: [],
    secureSecretHash: "64e48f3bf07307f751c02213b95e0b5e1e8351597dfbe12bce5cbf115591ce3f" // Clave: ADMIN2026
};

let activeFileBase64 = "";
let chartInstance = null;
let pendingEditIndex = -1;

// Guardar datos persistentemente en el dispositivo
function saveToLocalStorage() {
    localStorage.setItem('herencias_dashboard_state', JSON.stringify(state));
}

// Cargar datos al iniciar la página
function loadFromLocalStorage() {
    const saved = localStorage.getItem('herencias_dashboard_state');
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("Error al leer almacenamiento local, usando valores por defecto", e);
        }
    }
}

// Formateador de Divisas COP
function formatCurrency(val) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
}

// Actualización Dinámica del Dashboard e Interfaz de Usuario
function updateDashboard() {
    const pendingDiego = state.buyers["Diego Suárez"].total - state.buyers["Diego Suárez"].paid;
    const pendingFelipe = state.buyers["Felipe Suárez"].total - state.buyers["Felipe Suárez"].paid;
    const totalPending = pendingDiego + pendingFelipe;
    const totalCollected = state.buyers["Diego Suárez"].paid + state.buyers["Felipe Suárez"].paid;
    const percentCollected = ((totalCollected / 18000000) * 100).toFixed(1);

    document.getElementById('pending-diego').innerText = formatCurrency(pendingDiego);
    document.getElementById('pending-felipe').innerText = formatCurrency(pendingFelipe);
    document.getElementById('global-pending').innerText = formatCurrency(totalPending);
    document.getElementById('global-collected').innerText = formatCurrency(totalCollected);
    document.getElementById('global-percentage').innerText = `${percentCollected}% cubierto`;
    document.getElementById('ledger-count').innerText = `${state.ledger.length} transacciones`;

    const tbody = document.getElementById('ledger-body');
    if (state.ledger.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No se registran movimientos en el sistema.</td></tr>`;
    } else {
        tbody.innerHTML = "";
        state.ledger.forEach((item, index) => {
            const isPDF = item.image && item.image.startsWith("data:application/pdf");
            const icon = isPDF ? "fa-file-pdf" : "fa-file-image";
            const label = isPDF ? " PDF" : " Imagen";

            tbody.innerHTML += `
                <tr>
                    <td data-label="Fecha" style="color:#64748b; font-weight:500;">${item.timestamp}</td>
                    <td data-label="Comprador" style="font-weight:600; color:#0f172a;">${item.buyer}</td>
                    <td data-label="Valor" style="font-weight:700; color:#10b981;">${formatCurrency(item.amount)}</td>
                    <td data-label="Notas" style="color:#475569;">${item.notes}</td>
                    <td data-label="Soporte">
                        <button onclick="viewSupportFile(${index})" class="support-link">
                            <i class="fa-solid ${icon}"></i>${label}
                        </button>
                    </td>
                    <td class="no-print" data-label="Acciones">
                        <button onclick="requestEdit(${index})" class="btn-inline-edit"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                    </td>
                </tr>`;
        });
    }

    renderChart(totalCollected, totalPending);
}

// Visualizador de archivos de soporte sin bloqueo del navegador
function viewSupportFile(index) {
    const base64Data = state.ledger[index].image;
    if (!base64Data || base64Data.startsWith("http")) {
        alert("Este registro no cuenta con un archivo adjunto válido.");
        return;
    }
    
    if (base64Data.startsWith("data:application/pdf")) {
        const base64String = base64Data.split(',')[1];
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    } else {
        const newTab = window.open();
        newTab.document.write(`<img src="${base64Data}" style="max-width:100%; height:auto; display:block; margin:20px auto; box-shadow:0 4px 10px rgba(0,0,0,0.15); border-radius:8px;">`);
        newTab.document.title = "Soporte de Pago";
    }
}

// Integración Responsiva de Gráficos (Chart.js)
function renderChart(collected, pending) {
    const ctx = document.getElementById('financialChart').getContext('2d');
    if (chartInstance) { chartInstance.destroy(); }

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Recaudado', 'Pendiente'],
            datasets: [{
                data: [collected, pending],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: window.innerWidth > 768 ? 'right' : 'bottom', labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 10 } } }
            },
            cutout: '75%'
        }
    });
}

// Modales y Gestión Operativa
function openPaymentModal(buyerName) {
    document.getElementById('editIndex').value = "-1";
    document.getElementById('targetBuyer').value = buyerName;
    document.getElementById('modal-title').innerText = `Abono a: ${buyerName}`;
    document.getElementById('payFile').required = true;
    document.getElementById('paymentModal').classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
    document.getElementById('paymentForm').reset();
    activeFileBase64 = "";
}

// Convertidor Universal a Base64 (Soporta Cámara y Galería)
function handleFileChange(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { activeFileBase64 = e.target.result; };
        reader.readAsDataURL(input.files[0]);
    }
}

function submitPayment(e) {
    e.preventDefault();
    const buyer = document.getElementById('targetBuyer').value;
    const amount = parseFloat(document.getElementById('payAmount').value);
    const notes = document.getElementById('payNotes').value;
    const idx = parseInt(document.getElementById('editIndex').value);

    let currentPaidWithoutThis = state.buyers[buyer].paid;
    if (idx !== -1) { currentPaidWithoutThis -= state.ledger[idx].amount; }

    const maxAllowed = state.buyers[buyer].total - currentPaidWithoutThis;
    if (amount > maxAllowed) {
        alert(`Monto Inválido. Lo máximo por abonar para este comprador es ${formatCurrency(maxAllowed)}`);
        return;
    }

    if (idx === -1) {
        state.buyers[buyer].paid += amount;
        state.ledger.unshift({
            timestamp: new Date().toLocaleString('es-CO'),
            buyer: buyer,
            amount: amount,
            notes: notes,
            image: activeFileBase64 || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=150"
        });
    } else {
        state.buyers[buyer].paid = currentPaidWithoutThis + amount;
        state.ledger[idx].amount = amount;
        state.ledger[idx].notes = notes;
        if (activeFileBase64 !== "") { state.ledger[idx].image = activeFileBase64; }
    }

    saveToLocalStorage(); // Guardado permanente inmediato
    updateDashboard();
    closePaymentModal();
}

// Sistema de Modificación Segura (Clave Gerencial)
function requestEdit(index) {
    pendingEditIndex = index;
    document.getElementById('authPassphrase').value = "";
    document.getElementById('auth-error').classList.add('hidden');
    document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
    pendingEditIndex = -1;
}

function verifyAuth() {
    const input = document.getElementById('authPassphrase').value.trim().toUpperCase();
    const hashed = CryptoJS.SHA256(input).toString();

    if (hashed === state.secureSecretHash) {
        document.getElementById('authModal').classList.add('hidden');
        const record = state.ledger[pendingEditIndex];
        document.getElementById('editIndex').value = pendingEditIndex;
        document.getElementById('targetBuyer').value = record.buyer;
        document.getElementById('payAmount').value = record.amount;
        document.getElementById('payNotes').value = record.notes;
        
        document.getElementById('modal-title').innerText = `Editar Pago · ${record.buyer}`;
        document.getElementById('payFile').required = false;
        document.getElementById('paymentModal').classList.remove('hidden');
    } else {
        document.getElementById('auth-error').classList.remove('hidden');
    }
}

// Modal Contrato
function openContractModal() { document.getElementById('contractModal').classList.remove('hidden'); }
function closeContractModal() { document.getElementById('contractModal').classList.add('hidden'); }

// Cerrar cualquier modal con la tecla escape
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") { closeContractModal(); closePaymentModal(); closeAuthModal(); }
});

// Exportaciones
function exportToPDF() { window.print(); }
function exportToExcel() {
    let dataset = [
        ["INFORME CONTROL DE RECAUDOS - DERECHOS HERENCIALES"],
        ["Fecha de Reporte", new Date().toLocaleDateString()],
        [],
        ["ESTADO DE CUENTAS GLOBAL"],
        ["Comprador", "Obligación Total", "Recaudado", "Saldo Pendiente"],
        ["Diego Suárez", 9000000, state.buyers["Diego Suárez"].paid, 9000000 - state.buyers["Diego Suárez"].paid],
        ["Felipe Suárez", 9000000, state.buyers["Felipe Suárez"].paid, 9000000 - state.buyers["Felipe Suárez"].paid],
        ["TOTAL CONSOLIDADO", 18000000, state.buyers["Diego Suárez"].paid + state.buyers["Felipe Suárez"].paid, 18000000 - (state.buyers["Diego Suárez"].paid + state.buyers["Felipe Suárez"].paid)],
        [],
        ["DETALLE TRANSACCIONAL HISTÓRICO"],
        ["Fecha de Registro", "Comprador", "Monto", "Concepto/Notas"]
    ];
    state.ledger.forEach(i => dataset.push([i.timestamp, i.buyer, i.amount, i.notes]));
    const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(dataset);
    XLSX.utils.book_append_sheet(wb, ws, "Libro General");
    XLSX.writeFile(wb, "Reporte_Contable_Herencias.xlsx");
}

// Redibujar gráfico si cambia el tamaño de pantalla (orientación de celular)
window.addEventListener('resize', () => {
    const totalPending = (state.buyers["Diego Suárez"].total - state.buyers["Diego Suárez"].paid) + (state.buyers["Felipe Suárez"].total - state.buyers["Felipe Suárez"].paid);
    const totalCollected = state.buyers["Diego Suárez"].paid + state.buyers["Felipe Suárez"].paid;
    renderChart(totalCollected, totalPending);
});

// Inicialización del sistema
loadFromLocalStorage();
updateDashboard();
