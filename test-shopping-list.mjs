import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_URL = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');


let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✔  ${label}`);
    passed++;
  } else {
    console.error(`  ✘  ${label}`);
    failed++;
  }
}

const browser = await chromium.launch({ headless: false, slowMo: 400 });
const page = await browser.newPage();

// Clear localStorage before starting
await page.goto(FILE_URL);
await page.evaluate(() => localStorage.removeItem('shopping-list'));
await page.reload();

// ─────────────────────────────────────────────
console.log('\n[1] Initial empty state');
// ─────────────────────────────────────────────
const emptyMsg = await page.locator('.empty').textContent();
assert(emptyMsg.includes('empty'), 'Shows empty-state message when list is empty');

const statsText = await page.locator('#stats-label').textContent();
assert(statsText.trim() === '', 'Stats label is empty when no items');

// ─────────────────────────────────────────────
console.log('\n[2] Adding items');
// ─────────────────────────────────────────────
const input = page.locator('#item-input');
const addBtn = page.locator('#add-btn');

// Add via button
await input.fill('Milk');
await addBtn.click();
assert(await page.locator('.item-name').filter({ hasText: 'Milk' }).count() === 1, 'Add "Milk" via button');

// Add via Enter key
await input.fill('Eggs');
await input.press('Enter');
assert(await page.locator('.item-name').filter({ hasText: 'Eggs' }).count() === 1, 'Add "Eggs" via Enter key');

// Add third item
await input.fill('Bread');
await input.press('Enter');
assert(await page.locator('.item-name').filter({ hasText: 'Bread' }).count() === 1, 'Add "Bread"');

// Input clears after adding
assert((await input.inputValue()) === '', 'Input field clears after adding');

// Empty input should NOT add an item
await input.fill('   ');
await addBtn.click();
const itemCount = await page.locator('li:not(.empty)').count();
assert(itemCount === 3, 'Blank/whitespace input does not add an item');

// Stats update
const statsAfterAdd = await page.locator('#stats-label').textContent();
assert(statsAfterAdd.includes('3'), 'Stats label shows correct total count');

// ─────────────────────────────────────────────
console.log('\n[3] Checking items');
// ─────────────────────────────────────────────
const milkRow = page.locator('li').filter({ hasText: 'Milk' });
const milkCheckbox = milkRow.locator('input[type="checkbox"]');

await milkCheckbox.click();
assert(await milkCheckbox.isChecked(), 'Checkbox is checked after clicking');
assert(await milkRow.evaluate(el => el.classList.contains('checked')), 'Row gets "checked" class');

const milkName = milkRow.locator('.item-name');
const textDecoration = await milkName.evaluate(el => getComputedStyle(el).textDecoration);
assert(textDecoration.includes('line-through'), 'Checked item has line-through style');

const statsAfterCheck = await page.locator('#stats-label').textContent();
assert(statsAfterCheck.includes('1 of 3'), 'Stats show "1 of 3 checked"');

// Uncheck
await milkCheckbox.click();
assert(!(await milkCheckbox.isChecked()), 'Checkbox unchecks on second click');
assert(!(await milkRow.evaluate(el => el.classList.contains('checked'))), 'Row loses "checked" class on uncheck');

// ─────────────────────────────────────────────
console.log('\n[4] Deleting items');
// ─────────────────────────────────────────────
const eggsRow = page.locator('li').filter({ hasText: 'Eggs' });
const eggsDeleteBtn = eggsRow.locator('.delete-btn');

await eggsDeleteBtn.click();
assert(await page.locator('.item-name').filter({ hasText: 'Eggs' }).count() === 0, '"Eggs" removed after delete');

const countAfterDelete = await page.locator('li:not(.empty)').count();
assert(countAfterDelete === 2, 'List has 2 items after deleting one');

// ─────────────────────────────────────────────
console.log('\n[5] Persistence (localStorage)');
// ─────────────────────────────────────────────
await page.reload();
const countAfterReload = await page.locator('li:not(.empty)').count();
assert(countAfterReload === 2, 'Items persist after page reload');
assert(await page.locator('.item-name').filter({ hasText: 'Milk' }).count() === 1, '"Milk" still present after reload');
assert(await page.locator('.item-name').filter({ hasText: 'Bread' }).count() === 1, '"Bread" still present after reload');

// ─────────────────────────────────────────────
console.log('\n[6] Clear checked button');
// ─────────────────────────────────────────────
// Check all remaining items
for (const cb of await page.locator('input[type="checkbox"]').all()) {
  await cb.click();
}

const clearBtn = page.locator('#clear-checked-btn');
assert(await clearBtn.isVisible(), '"Clear checked" button appears when items are checked');

await clearBtn.click();
const countAfterClear = await page.locator('li:not(.empty)').count();
assert(countAfterClear === 0, 'All checked items removed after "Clear checked"');

const emptyAfterClear = await page.locator('.empty').count();
assert(emptyAfterClear === 1, 'Empty-state message reappears after clearing all');

// ─────────────────────────────────────────────
console.log('\n─────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('─────────────────────────────────\n');

await browser.close();
process.exit(failed > 0 ? 1 : 0);
