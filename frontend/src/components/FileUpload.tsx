import { useState, useRef, DragEvent, ChangeEvent } from 'react'

interface Props {
  onUpload: (orders: File, settlements: File) => void
  loading: boolean
  error: string | null
}

function DropZone({
  label,
  hint,
  file,
  onFile,
}: {
  label: string
  hint: string
  file: File | null
  onFile: (f: File) => void
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = (f: File) => {
    if (f.name.endsWith('.csv') || f.type === 'text/csv' || f.type === 'application/vnd.ms-excel') {
      onFile(f)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) accept(f)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) accept(f)
  }

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
        ${dragging ? 'border-indigo-400 bg-indigo-950/40' : file ? 'border-emerald-500 bg-emerald-950/30' : 'border-slate-600 hover:border-slate-400 bg-slate-800/50'}
      `}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onChange} />
      {file ? (
        <>
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-emerald-400 font-medium text-sm truncate max-w-[200px] mx-auto">{file.name}</p>
          <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-white font-medium text-sm">{label}</p>
          <p className="text-slate-400 text-xs mt-1">{hint}</p>
          <p className="text-slate-500 text-xs mt-2">Drag & drop or click to browse</p>
        </>
      )}
    </div>
  )
}

function SampleDownload() {
  return (
    <div className="mb-6 p-4 bg-indigo-950/50 border border-indigo-800/60 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-semibold">Try with sample data</p>
          <p className="text-slate-400 text-xs mt-0.5 mb-3">
            25,000 real-looking transactions across MXN, BRL, IDR, KES and COP — with intentional discrepancies injected.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/sample-data/orders.csv"
              download="orders.csv"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              orders.csv
              <span className="opacity-60">(1.2 MB)</span>
            </a>
            <a
              href="/sample-data/settlements.csv"
              download="settlements.csv"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              settlements.csv
              <span className="opacity-60">(1.2 MB)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FileUpload({ onUpload, loading, error }: Props) {
  const [ordersFile, setOrdersFile] = useState<File | null>(null)
  const [settlementsFile, setSettlementsFile] = useState<File | null>(null)

  const ready = ordersFile && settlementsFile && !loading

  return (
    <div className="w-full max-w-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">Multi-Currency Reconciliation</h2>
        <p className="text-slate-400 text-base max-w-lg mx-auto">
          Upload your order and settlement files to identify FX discrepancies,
          missing settlements, and suspicious patterns across 5 currencies.
        </p>
      </div>

      <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <SampleDownload />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <DropZone
            label="Orders CSV"
            hint="transaction_id, order_date, customer_currency, original_amount, payment_processor"
            file={ordersFile}
            onFile={setOrdersFile}
          />
          <DropZone
            label="Settlements CSV"
            hint="transaction_id, settlement_date, usd_amount_received, fx_rate_applied, fees_deducted"
            file={settlementsFile}
            onFile={setSettlementsFile}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          disabled={!ready}
          onClick={() => ready && onUpload(ordersFile!, settlementsFile!)}
          className={`
            w-full py-3 rounded-xl font-semibold text-sm transition-all
            ${ready
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 cursor-pointer'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
          `}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Reconciling transactions…
            </span>
          ) : 'Run Reconciliation'}
        </button>
      </div>

      <p className="text-center text-slate-600 text-xs mt-4">
        Files are processed server-side and never stored permanently
      </p>
    </div>
  )
}
