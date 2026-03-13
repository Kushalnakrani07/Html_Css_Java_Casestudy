// ============================
// 📊 STOCK DATA
// ============================
const STOCKS = {
    AAPL: { name: "Apple", price: 150, color: "#4cc9f0", volatility: 0.015 },
    TSLA: { name: "Tesla", price: 250, color: "#ff4d6d", volatility: 0.03 },
    GOOG: { name: "Google", price: 130, color: "#ffd60a", volatility: 0.02 },
    AMZN: { name: "Amazon", price: 180, color: "#00e676", volatility: 0.018 },
    NVDA: { name: "Nvidia", price: 450, color: "#c77dff", volatility: 0.035 },
};

// ============================
// 💾 GAME STATE
// ============================
let cash = 10000;
let selectedStock = "AAPL";
let portfolio = {}; // { AAPL: { qty: 10, avgCost: 145.0 } }
let openPrice = {};
let volTracker = {};
let tickInterval = null;
let TICK_SPEED = 1200;

// init
Object.keys(STOCKS).forEach(sym => {
    openPrice[sym] = STOCKS[sym].price;
    volTracker[sym] = 0;
});

// ============================
// 🖱️ DOM REFS
// ============================
const balanceDisplay = document.getElementById("balanceDisplay");
const stockSymbolEl = document.getElementById("stockSymbol");
const stockPriceEl = document.getElementById("stockPrice");
const priceChangeEl = document.getElementById("priceChange");
const qtyInput = document.getElementById("qtyInput");
const costPreview = document.getElementById("costPreview");
const portfolioList = document.getElementById("portfolioList");
const tradeLog = document.getElementById("tradeLog");
const toast = document.getElementById("toast");

// ============================
// 📈 PRICE ENGINE (The Fun Part!)
// ============================
function tick() {
    Object.keys(STOCKS).forEach(sym => {
        const s = STOCKS[sym];
        // Random walk — price goes up or down randomly
        const drift = (Math.random() - 0.48) * s.volatility; // slight upward bias
        const newPrice = Math.max(1, +(s.price * (1 + drift)).toFixed(2));
        STOCKS[sym].price = newPrice;
        volTracker[sym] += Math.floor(Math.random() * 5000 + 1000);
    });

    updateUI();
}

function startTicker() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(tick, TICK_SPEED);
}

// ============================
// 🔄 UI UPDATER
// ============================
function updateUI() {
    const sym = selectedStock;
    const price = STOCKS[sym].price;
    const open = openPrice[sym];
    const change = price - open;
    const changePct = (change / open) * 100;

    // OHLV — track high/low via volTracker accumulation; use price as placeholder
    const high = price.toFixed(2);
    const low = price.toFixed(2);

    // Price display
    stockSymbolEl.textContent = `${sym} · ${STOCKS[sym].name}`;
    stockPriceEl.textContent = `$${price.toFixed(2)}`;
    stockPriceEl.className = `stock-price ${change >= 0 ? "up" : "down"}`;
    priceChangeEl.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)} (${changePct.toFixed(2)}%)`;
    priceChangeEl.className = `price-change ${change >= 0 ? "up" : "down"}`;
    document.getElementById("infoOpen").textContent = `$${open.toFixed(2)}`;
    document.getElementById("infoHigh").textContent = `$${high}`;
    document.getElementById("infoLow").textContent = `$${low}`;
    document.getElementById("infoVol").textContent = (volTracker[sym] / 1000).toFixed(1) + "K";

    // Balance
    balanceDisplay.textContent = `$${cash.toFixed(2)}`;

    // Cost preview
    const qty = parseInt(qtyInput.value) || 1;
    costPreview.textContent = `$${(qty * price).toFixed(2)}`;

    // Portfolio
    updatePortfolio();

    // Net worth
    updateNetWorth();
}

function updatePortfolio() {
    if (Object.keys(portfolio).length === 0) {
        portfolioList.innerHTML = `<div class="empty-port">No stocks yet. Start buying!</div>`;
        return;
    }

    let html = "";
    Object.keys(portfolio).forEach(sym => {
        const p = portfolio[sym];
        if (p.qty <= 0) return;
        const currentPrice = STOCKS[sym].price;
        const currentValue = currentPrice * p.qty;
        const costBasis = p.avgCost * p.qty;
        const pnl = currentValue - costBasis;
        const pnlClass = pnl >= 0 ? "up" : "down";
        const pnlSign = pnl >= 0 ? "+" : "";

        html += `
      <div class="portfolio-item">
        <div>
          <div class="port-sym">${sym}</div>
          <div class="port-qty">${p.qty} shares @ $${p.avgCost.toFixed(2)}</div>
        </div>
        <div style="text-align:right">
          <div class="port-value">$${currentValue.toFixed(2)}</div>
          <div class="port-pnl ${pnlClass}">${pnlSign}$${pnl.toFixed(2)}</div>
        </div>
      </div>`;
    });

    portfolioList.innerHTML = html || `<div class="empty-port">No active positions</div>`;
}

function updateNetWorth() {
    let holdingsValue = 0;
    Object.keys(portfolio).forEach(sym => {
        if (portfolio[sym].qty > 0)
            holdingsValue += portfolio[sym].qty * STOCKS[sym].price;
    });
    const total = cash + holdingsValue;
    const pnl = total - 10000;
    const pnlClass = pnl >= 0 ? "up" : "down";
    const pnlSign = pnl >= 0 ? "+" : "";

    document.getElementById("nwCash").textContent = `$${cash.toFixed(0)}`;
    document.getElementById("nwHoldings").textContent = `$${holdingsValue.toFixed(0)}`;
    document.getElementById("nwTotal").textContent = `$${total.toFixed(0)}`;
    const pnlEl = document.getElementById("nwPnl");
    pnlEl.textContent = `${pnlSign}$${pnl.toFixed(2)}`;
    pnlEl.className = `nw-value ${pnlClass}`;
}

// ============================
// 🛒 BUY & SELL LOGIC
// ============================
function buyStock() {
    const sym = selectedStock;
    const qty = parseInt(qtyInput.value);
    if (!qty || qty <= 0) return showToast("⚠️ Enter a valid quantity!");

    const price = STOCKS[sym].price;
    const totalCost = price * qty;

    if (totalCost > cash) {
        return showToast(`❌ Not enough cash! Need $${totalCost.toFixed(2)}`);
    }

    cash -= totalCost;

    if (!portfolio[sym]) portfolio[sym] = { qty: 0, avgCost: 0 };
    const prev = portfolio[sym];
    // Weighted average cost
    const newAvg = ((prev.qty * prev.avgCost) + (qty * price)) / (prev.qty + qty);
    portfolio[sym].qty += qty;
    portfolio[sym].avgCost = newAvg;

    addLog("BUY", sym, qty, price);
    showToast(`✅ Bought ${qty} ${sym} @ $${price.toFixed(2)}`);
    updateUI();
}

function sellStock() {
    const sym = selectedStock;
    const qty = parseInt(qtyInput.value);
    if (!qty || qty <= 0) return showToast("⚠️ Enter a valid quantity!");

    if (!portfolio[sym] || portfolio[sym].qty < qty) {
        return showToast(`❌ You only have ${portfolio[sym]?.qty || 0} shares of ${sym}`);
    }

    const price = STOCKS[sym].price;
    const proceeds = price * qty;

    cash += proceeds;
    portfolio[sym].qty -= qty;

    addLog("SELL", sym, qty, price);
    showToast(`💰 Sold ${qty} ${sym} @ $${price.toFixed(2)}`);
    updateUI();
}

// ============================
// 📋 TRADE LOG
// ============================
let logCount = 0;
function addLog(type, sym, qty, price) {
    if (logCount === 0) tradeLog.innerHTML = "";
    logCount++;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const div = document.createElement("div");
    div.className = `log-entry log-${type.toLowerCase()}`;
    div.innerHTML = `<span>${type} ${qty}x ${sym} @ $${price.toFixed(2)}</span><span class="log-time">${time}</span>`;
    tradeLog.prepend(div);
}

// ============================
// 💬 TOAST
// ============================
let toastTimer;
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ============================
// 🗂️ STOCK TABS
// ============================
const tabsContainer = document.getElementById("stockTabs");
Object.keys(STOCKS).forEach(sym => {
    const btn = document.createElement("button");
    btn.className = "stock-tab" + (sym === selectedStock ? " active" : "");
    btn.textContent = sym;
    btn.onclick = () => {
        selectedStock = sym;
        document.querySelectorAll(".stock-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        updateUI();
    };
    tabsContainer.appendChild(btn);
});

// ============================
// 🎛️ CONTROLS
// ============================
document.getElementById("qtyMinus").onclick = () => {
    qtyInput.value = Math.max(1, parseInt(qtyInput.value || 1) - 1);
    updateUI();
};

document.getElementById("qtyPlus").onclick = () => {
    qtyInput.value = parseInt(qtyInput.value || 1) + 1;
    updateUI();
};

qtyInput.addEventListener("input", updateUI);

document.getElementById("btnBuy").onclick = buyStock;
document.getElementById("btnSell").onclick = sellStock;

document.getElementById("speedRange").addEventListener("input", function () {
    TICK_SPEED = parseInt(this.value);
    document.getElementById("speedLabel").textContent = (TICK_SPEED / 1000).toFixed(1) + "s";
    startTicker();
});

// ============================
// 🚀 INIT
// ============================
updateUI();
startTicker();