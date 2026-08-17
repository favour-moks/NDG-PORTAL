// Regenerates the synthetic fixture files in this directory. Run with:
//   node tests/import/fixtures/generate.mjs
//
// These are NOT real records. The real "Edo Coaches Payment Report.xlsx"
// (per docs/product-roadmap.md, TASK-019) was unavailable when Phase 1 was
// built and would have contained real people's BVN/NIN and bank details —
// not something to fabricate. This generates fictional data with the same
// documented structural quirks so the import/validation/dedup pipeline can
// be built and proven now; see README.md for what each file is for.
import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'

const TEMPLATE_COLUMNS = ['Full Name', 'Account Name', 'Account Number', 'Bank Name', 'BVN', 'NIN']

const BANK_SPELLINGS = [
  'GTBANK',
  'STANBIC IBTC BANK',
  'UNITED BANK FOR AFRICA',
  'FIRST BANK',
  'FCMB',
  'Polaris Bank',
  'ZENITH BANK',
  'STERLING BANK',
  'WEMA BANK',
  'FIDELITY BANK',
  'ECOBANK',
]

const FIRST_NAMES = [
  'Chinedu', 'Ngozi', 'Emeka', 'Amaka', 'Tunde', 'Folake', 'Ifeanyi', 'Bisi',
  'Obinna', 'Chiamaka', 'Segun', 'Adaeze', 'Kelechi', 'Yemisi', 'Uche',
  'Temitope', 'Nnamdi', 'Oluwaseun', 'Chukwudi', 'Aisha', 'Babatunde',
  'Chidinma', 'Emmanuel', 'Grace', 'Ikechukwu', 'Joy', 'Kunle', 'Linda',
  'Michael', 'Nkechi', 'Peter', 'Queeneth', 'Rasheed', 'Sandra', 'Tobenna',
  'Uzoma', 'Victoria', 'Williams', 'Xoli', 'Yusuf', 'Zainab', 'Ade', 'Bola',
  'Chika', 'Daniel', 'Ebere',
]

const LAST_NAMES = [
  'Okafor', 'Adeyemi', 'Nwosu', 'Okonkwo', 'Balogun', 'Eze', 'Abubakar',
  'Madueke', 'Igwe', 'Adebayo', 'Chukwu', 'Okoro', 'Yusuf', 'Nnaji',
  'Ogunleye', 'Umeh', 'Bello', 'Ibrahim', 'Onyekwere', 'Afolabi', 'Ejiofor',
  'Musa', 'Nwachukwu', 'Adeleke', 'Obi', 'Suleiman', 'Anyanwu', 'Okeke',
  'Ogundipe', 'Chukwuemeka', 'Aliyu', 'Nwafor', 'Adekunle', 'Emeka',
  'Onwuka', 'Sani', 'Nweke', 'Adeoye', 'Ugochukwu', 'Danjuma', 'Ekwueme',
  'Folarin', 'Chinweike', 'Abiodun', 'Nnamani',
]

function fullName(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]
  const last = LAST_NAMES[index % LAST_NAMES.length]
  return `${first} ${last}`
}

// 10-digit account number. `variant` lets a handful of rows share a
// deliberately similar prefix (the "don't fuzzy-match account numbers"
// trap) without colliding with the sequential default numbers.
function accountNumber(index, { leadingZero = false, override } = {}) {
  if (override) return override
  const base = leadingZero
    ? '0' + String(2000000 + index).padStart(9, '0')
    : String(3000000000 + index * 7919).slice(0, 10)
  return base.padStart(10, '0').slice(0, 10)
}

function elevenDigitId(seed) {
  return String(10000000000 + seed).slice(0, 11).padStart(11, '0')
}

// 16 rows get leading-zero accounts, spread through the sheet.
const LEADING_ZERO_ROWS = new Set([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 41, 44])
// A different 16 rows get ALL CAPS names with shuffled word order.
const ALL_CAPS_ROWS = new Set([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 42, 43])
// Rows 5, 14, 23, 32 are the four Fidelity Bank accounts sharing a prefix.
const FIDELITY_ROWS = [5, 14, 23, 32]
const FIDELITY_ACCOUNTS = ['5511234501', '5511234502', '5511298765', '5511276543']

// Every non-Fidelity row cycles through the other 10 spellings — Fidelity
// Bank is reserved exclusively for the 4 FIDELITY_ROWS below, so the trap
// (four accounts under one bank sharing a prefix) isn't diluted by the
// round-robin also landing on Fidelity by coincidence.
const OTHER_BANK_SPELLINGS = BANK_SPELLINGS.filter((b) => b !== 'FIDELITY BANK')

function buildRows() {
  const rows = []
  let fidelityCursor = 0
  let otherBankCursor = 0

  for (let i = 0; i < 45; i++) {
    const isFidelity = FIDELITY_ROWS.includes(i)
    const bank = isFidelity ? 'FIDELITY BANK' : OTHER_BANK_SPELLINGS[otherBankCursor++ % OTHER_BANK_SPELLINGS.length]
    const name = fullName(i)
    const displayName =
      ALL_CAPS_ROWS.has(i)
        ? name.split(' ').reverse().join(' ').toUpperCase()
        : name

    const account = isFidelity
      ? FIDELITY_ACCOUNTS[fidelityCursor++]
      : accountNumber(i, { leadingZero: LEADING_ZERO_ROWS.has(i) })

    // Every row gets a NIN; every third row also gets a BVN, so both
    // "NIN only" and "both present" paths are exercised.
    const nin = elevenDigitId(100000 + i)
    const bvn = i % 3 === 0 ? elevenDigitId(900000 + i) : ''

    rows.push({
      'Full Name': displayName,
      'Account Name': name.toUpperCase(),
      'Account Number': account,
      'Bank Name': bank,
      BVN: bvn,
      NIN: nin,
    })
  }

  return rows
}

async function writeWorkbook(filePath, rows, { corruptAccountNumbers = false } = {}) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Import')
  sheet.addRow(TEMPLATE_COLUMNS)

  const accountColIndex = TEMPLATE_COLUMNS.indexOf('Account Number') + 1

  for (const row of rows) {
    const excelRow = sheet.addRow(TEMPLATE_COLUMNS.map((col) => row[col]))
    const cell = excelRow.getCell(accountColIndex)
    if (corruptAccountNumbers) {
      // The corruption under test: Excel stores the account number as a
      // number, which silently drops any leading zero.
      cell.value = Number(row['Account Number'])
    } else {
      cell.numFmt = '@'
      cell.value = row['Account Number']
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  writeFileSync(filePath, Buffer.from(buffer))
}

async function writeWrongTemplate(filePath) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Import')
  sheet.addRow(['Name', 'Amount', 'Notes'])
  sheet.addRow(['Ada Obi', '5000', 'Wrong template entirely'])
  const buffer = await workbook.xlsx.writeBuffer()
  writeFileSync(filePath, Buffer.from(buffer))
}

const rows = buildRows()
await writeWorkbook(new URL('./edo-coaches-real.xlsx', import.meta.url), rows)
await writeWorkbook(new URL('./edo-coaches-zeros-destroyed.xlsx', import.meta.url), rows, {
  corruptAccountNumbers: true,
})
await writeWrongTemplate(new URL('./wrong-template.xlsx', import.meta.url))

console.log('Wrote edo-coaches-real.xlsx, edo-coaches-zeros-destroyed.xlsx, wrong-template.xlsx')
