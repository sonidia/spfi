<template>
  <div class="setup-guide">
    <div class="hero">
      <div class="hero-icon">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <h1>Shopify Store Manager</h1>
      <p class="subtitle">
        Setup guide — làm theo các bước dưới đây để kết nối store Shopify của
        bạn
      </p>
    </div>

    <div class="steps">
      <!-- STEP 1 -->
      <div class="step-card">
        <div class="step-header">
          <span class="step-badge">01</span>
          <h2>Lấy Store ID</h2>
        </div>
        <div class="step-body">
          <p>
            Vào trang <span class="tag">Domain</span> và copy và lưu lại
            <span class="tag">Store ID</span>.
          </p>
          <div class="example-block">
            <div class="example-label">Ví dụ</div>
            <div class="example-content">
              <code class="code-inline">3ute8a-h4.myshopify.com</code>
              <span class="arrow">→</span>
              <span class="example-result"
                >Store ID:
                <code class="code-inline highlight">3ute8a-h4</code></span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- STEP 2 -->
      <div class="step-card">
        <div class="step-header">
          <span class="step-badge">02</span>
          <h2>Tạo App</h2>
        </div>
        <div class="step-body">
          <ol class="steps-list">
            <li>Vào trang <span class="tag">Apps</span></li>
            <li>Chọn <span class="tag">Develop apps</span></li>
            <li>Click <span class="tag">Build apps in Dev Dashboard</span></li>
            <li>Click <span class="tag">Create app</span></li>
            <li>
              Đặt tên app (điền shop domain) — ví dụ:
              <code class="code-inline">fitblend.store</code>
            </li>
          </ol>
        </div>
      </div>

      <!-- STEP 3 -->
      <div class="step-card">
        <div class="step-header">
          <span class="step-badge">03</span>
          <h2>Cấu hình App <span class="tab-label">Tab Versions</span></h2>
        </div>
        <div class="step-body">
          <div class="config-grid">
            <div class="config-row">
              <span class="config-key">Redirect URL</span>
              <code class="code-inline">http://localhost</code>
            </div>
            <div class="config-row">
              <span class="config-key">App URL</span>
              <code class="code-inline">http://localhost/new-install</code>
            </div>
            <div class="config-row">
              <span class="config-key">Embed in admin</span>
              <span class="badge-off">Bỏ tick</span>
            </div>
            <div class="config-row">
              <span class="config-key">API version (mặc định có sẵn)</span>
              <code class="code-inline highlight">2026-04</code>
            </div>
          </div>

          <div class="scope-block">
            <div class="scope-label">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Scopes
            </div>
            <pre class="scope-code">
read_all_orders,read_customers,write_customers,read_delivery_customizations,write_delivery_customizations,write_draft_orders,read_draft_orders,write_order_edits,read_order_edits,read_orders,write_orders,read_product_listings,write_product_listings,read_products,write_products,read_shopify_payments_payouts,shopify_payments,shopify_payments_payouts,shopify_payments_accounts</pre
            >
          </div>

          <div class="action-hint">
            <div class="action-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            Sau đó kéo lên và click <span class="tag">Release → Release</span>
          </div>
        </div>
      </div>

      <!-- STEP 4 -->
      <div class="step-card">
        <div class="step-header">
          <span class="step-badge">04</span>
          <h2>Lấy Credentials <span class="tab-label">Tab Settings</span></h2>
        </div>
        <div class="step-body">
          <div class="credential-list">
            <div class="credential-item">
              <div class="credential-icon">ID</div>
              <div>
                <div class="credential-name">Client ID</div>
                <div class="credential-hint">Copy và lưu lại</div>
              </div>
            </div>
            <div class="credential-item">
              <div class="credential-icon">SK</div>
              <div>
                <div class="credential-name">Client Secret</div>
                <div class="credential-hint">Copy và lưu lại</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- STEP 5 -->
      <div class="step-card">
        <div class="step-header">
          <span class="step-badge">05</span>
          <h2>
            Cài App
            <span class="tab-label">Tab đầu tiên</span>
          </h2>
        </div>
        <div class="step-body">
          <ol class="steps-list">
            <li>Click <span class="tag">Install app</span></li>
            <li>Chọn store hiện tại → <span class="tag">Install</span></li>
          </ol>
        </div>
      </div>
    </div>

    <!-- NOTE -->
    <div class="note-card">
      <div class="note-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polyline
            points="14,2 14,8 20,8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div>
        <div class="note-title">Note vào sheet theo format</div>
        <code class="code-inline note-format"
          >store_id/client_id/client_secret</code
        >
      </div>
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
.setup-guide {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px;
  font-family:
    -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
  color: #1a1a1a;
  line-height: 1.6;
}

/* Hero */
.hero {
  text-align: center;
  margin-bottom: 48px;
}

.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: #f0f0ff;
  border-radius: 16px;
  color: #5b47e0;
  margin-bottom: 16px;
}

.hero h1 {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.4px;
  margin: 0 0 10px;
  color: #111;
}

.subtitle {
  color: #6b7280;
  font-size: 15px;
  max-width: 420px;
  margin: 0 auto;
}

/* Step cards */
.steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-card {
  background: #fff;
  border: 1px solid #e8e8ed;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 10px;
  transition: box-shadow 0.15s ease;
}

.step-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px 14px;
  border-bottom: 1px solid #f0f0f4;
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #f4f3ff;
  color: #5b47e0;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.step-header h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #111;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tab-label {
  font-size: 12px;
  font-weight: 500;
  color: #7c6fcd;
  background: #f0effc;
  padding: 2px 8px;
  border-radius: 20px;
}

.step-body {
  padding: 18px 22px 20px;
}

.step-body > p {
  margin: 0 0 14px;
  font-size: 14px;
  color: #374151;
}

/* Tags */
.tag {
  display: inline-block;
  background: #f5f5f7;
  color: #333;
  font-size: 13px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 5px;
  border: 1px solid #e0e0e6;
}

/* Code */
.code-inline {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 13px;
  background: #f5f5f7;
  color: #d63384;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #eaeaef;
}

.code-inline.highlight {
  background: #fff5f0;
  color: #c2410c;
  border-color: #fddccc;
}

/* Example block */
.example-block {
  background: #fafafa;
  border: 1px solid #e8e8ed;
  border-radius: 10px;
  padding: 14px 16px;
  margin-top: 4px;
}

.example-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.example-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 14px;
}

.arrow {
  color: #9ca3af;
  font-size: 16px;
}

.example-result {
  color: #374151;
  font-size: 14px;
}

/* Steps list */
.steps-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  counter-reset: step-counter;
}

.steps-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #374151;
  counter-increment: step-counter;
}

.steps-list li::before {
  content: counter(step-counter);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  background: #ededf5;
  color: #7c6fcd;
  font-size: 11px;
  font-weight: 600;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Config grid */
.config-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #e8e8ed;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 16px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  font-size: 13.5px;
  gap: 16px;
}

.config-row:not(:last-child) {
  border-bottom: 1px solid #f0f0f4;
}

.config-row:nth-child(odd) {
  background: #fafafa;
}

.config-key {
  color: #6b7280;
  font-weight: 500;
  flex-shrink: 0;
}

.badge-off {
  font-size: 12px;
  font-weight: 500;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 2px 8px;
  border-radius: 20px;
}

/* Scope block */
.scope-block {
  background: #f9f9fc;
  border: 1px solid #e8e8ed;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 14px;
}

.scope-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
  padding: 10px 14px;
  border-bottom: 1px solid #e8e8ed;
  background: #f3f3f8;
}

.scope-code {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 12px;
  color: #374151;
  line-height: 1.8;
  margin: 0;
  padding: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Action hint */
.action-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: #4b5563;
  background: #f0effc;
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 3px solid #7c6fcd;
}

.action-icon {
  display: flex;
  align-items: center;
  color: #7c6fcd;
  flex-shrink: 0;
}

/* Credentials */
.credential-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.credential-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #fafafa;
  border: 1px solid #e8e8ed;
  border-radius: 10px;
}

.credential-icon {
  width: 40px;
  height: 40px;
  background: #f0effc;
  color: #5b47e0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.credential-name {
  font-size: 14px;
  font-weight: 600;
  color: #111;
  margin-bottom: 2px;
}

.credential-hint {
  font-size: 12px;
  color: #9ca3af;
}

/* Note card */
.note-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 12px;
}

.note-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #dcfce7;
  color: #16a34a;
  border-radius: 8px;
  flex-shrink: 0;
}

.note-title {
  font-size: 13px;
  font-weight: 600;
  color: #15803d;
  margin-bottom: 6px;
}

.note-format {
  background: #fff;
  border-color: #bbf7d0;
  color: #166534;
  font-size: 13px;
}
</style>
