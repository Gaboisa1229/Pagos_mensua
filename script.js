// Memoria del Dashboard
let state = {
    buyers: {
        "Diego Suárez": { total: 9000000, paid: 0 },
        "Felipe Suárez": { total: 9000000, paid: 0 }
    },
    ledger: [],
    // CORREGIDO: Hash SHA-256 exacto correspondiente a "ADMIN2026"
    secureSecretHash: "64e48f3bf07307f751c02213b95e0b5e1e8351597dfbe12bce5cbf115591ce3f"
};

let activeFileBase64 = "";
let chartInstance = null;
let pendingEditIndex = -1;

// Formateador de Divisas COP
function formatCurrency(val) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
}

// Inicialización e Inyección Dinámica de Datos
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
    document.getElementById('global-percentage').innerText = `${percentCollected}% del total recaudado`;
    document.getElementById('ledger-count').innerText = `${state.ledger.length} transacciones`;

    const tbody = document.getElementById('ledger-body');
    if (state.ledger.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No se registran movimientos en el periodo actual.</td></tr>`;
    } else {
        tbody.innerHTML = "";
        state.ledger.forEach((item, index) => {
            const isPDF = item.image.startsWith("data:application/pdf");
            const icon = isPDF ? "fa-file-pdf" : "fa-file-image";
            const label = isPDF ? " Ver PDF" : " Ver Imagen";

            tbody.innerHTML += `
                <tr>
                    <td style="color:#64748b; font-weight:500;">${item.timestamp}</td>
                    <td style="font-weight:600; color:#0f172a;">${item.buyer}</td>
                    <td style="font-weight:700; color:#10b981;">${formatCurrency(item.amount)}</td>
                    <td style="color:#475569;">${item.notes}</td>
                    <td>
                        <button onclick="viewSupportFile(${index})" class="support-link">
                            <i class="fa-solid ${icon}"></i>${label}
                        </button>
                    </td>
                    <td class="no-print">
                        <button onclick="requestEdit(${index})" class="btn-inline-edit"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                    </td>
                </tr>`;
        });
    }

    renderChart(totalCollected, totalPending);
}

// Visualizador dinámico antibloqueo
function viewSupportFile(index) {
    const base64Data = state.ledger[index].image;
    
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
        newTab.document.write(`<img src="${base64Data}" style="max-width:100%; height:auto; display:block; margin:20px auto; box-shadow:0 4px 10px rgba(0,0,0,0.25); border-radius:8px;">`);
        newTab.document.title = "Soporte de Pago";
    }
}

// Dibujo e Integración de Chart.js
function renderChart(collected, pending) {
    const ctx = document.getElementById('financialChart').getContext('2d');
    if (chartInstance) { chartInstance.destroy(); }

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Recaudado (COP)', 'Pendiente por Cobrar (COP)'],
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
                legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11 } } }
            },
            cutout: '70%'
        }
    });
}

// Controladores de Registro Abierto
function openPaymentModal(buyerName) {
    document.getElementById('editIndex').value = "-1";
    document.getElementById('targetBuyer').value = buyerName;
    document.getElementById('modal-title').innerText = `Registrar Abono · ${buyerName}`;
    document.getElementById('file-group').style.display = "flex";
    document.getElementById('payFile').required = true;
    document.getElementById('paymentModal').classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
    document.getElementById('paymentForm').reset();
    activeFileBase64 = "";
}

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
        alert(`Operación Inválida. El monto máximo disponible para abonar a este comprador es ${formatCurrency(maxAllowed)}`);
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

    updateDashboard();
    closePaymentModal();
}

// Gestión del Sistema de Modificación Segura
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
    // Convierte el texto automáticamente a mayúsculas para evitar fallos de escritura
    const input = document.getElementById('authPassphrase').value.trim().toUpperCase();
    const hashed = CryptoJS.SHA256(input).toString();

    if (hashed === state.secureSecretHash) {
        document.getElementById('authModal').classList.add('hidden');
        const record = state.ledger[pendingEditIndex];
        document.getElementById('editIndex').value = pendingEditIndex;
        document.getElementById('targetBuyer').value = record.buyer;
        document.getElementById('payAmount').value = record.amount;
        document.getElementById('payNotes').value = record.notes;
        
        document.getElementById('modal-title').innerText = `Corregir Transacción · ${record.buyer}`;
        document.getElementById('file-group').style.display = "flex";
        document.getElementById('payFile').required = false;
        
        document.getElementById('paymentModal').classList.remove('hidden');
    } else {
        document.getElementById('auth-error').classList.remove('hidden');
    }
}

// Funciones del modal del contrato
function openContractModal() {
    document.getElementById('contractModal').classList.remove('hidden');
}

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        closeContractModal();
        closePaymentModal();
        closeAuthModal();
    }
});

function closeContractModal() {
    document.getElementById('contractModal').classList.add('hidden');
}

// Motores de Conversión Externa
function exportToPDF() { window.print(); }

function exportToExcel() {
    let dataset = [
        ["INFORME GERENCIAL - CONTROL DE RECAUDOS"],
        ["Fecha de Emisión", new Date().toLocaleDateString()],
        [],
        ["ESTADO GLOBAL DE CUENTAS"],
        ["Comprador Asignado", "Compromiso Inicial", "Total Recaudado", "Saldo Neto Pendiente"],
        ["Diego Suárez", 9000000, state.buyers["Diego Suárez"].paid, 9000000 - state.buyers["Diego Suárez"].paid],
        ["Felipe Suárez", 9000000, state.buyers["Felipe Suárez"].paid, 9000000 - state.buyers["Felipe Suárez"].paid],
        ["TOTAL CONSOLIDADO", 18000000, state.buyers["Diego Suárez"].paid + state.buyers["Felipe Suárez"].paid, 18000000 - (state.buyers["Diego Suárez"].paid + state.buyers["Felipe Suárez"].paid)],
        [],
        ["DETALLE CRONOLÓGICO DE INGRESOS AUDITADOS"],
        ["Fecha/Hora de Registro", "Comprador", "Monto del Abono", "Observaciones del Operador"]
    ];
    state.ledger.forEach(i => dataset.push([i.timestamp, i.buyer, i.amount, i.notes]));
    const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(dataset);
    XLSX.utils.book_append_sheet(wb, ws, "Libro de Recaudos");
    XLSX.writeFile(wb, "Reporte_Cuentas_Herenciales.xlsx");
}

updateDashboard();