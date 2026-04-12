const { formatDate, cleanTag } = require('./utils');
const log = require('./logger');

/**
 * Transforms a raw Paytm transaction record to Firefly III format
 * @param {Object} txn - Raw Paytm transaction record from processCSV
 * @param {Object} config - Configuration object
 * @param {string} fireflyAccountId - Firefly III asset account ID
 * @returns {Object} - Transaction in Firefly III format
 */
function transformToFirefly(txn, config, fireflyAccountId) {
  const rawAmount = txn[config.columns.amount].replace(/,/g, '');
  const amountFloat = parseFloat(rawAmount);
  const isExpense = amountFloat < 0;
  const absAmount = Math.abs(amountFloat).toFixed(2);

  const payee = txn[config.columns.transactionDetails] || 'Unknown';
  const firstTag = (txn[config.columns.tags] || '').trim();
  const categoryName = firstTag ? cleanTag(firstTag) : null;

  const base = {
    type: isExpense ? 'withdrawal' : 'deposit',
    date: formatDate(txn[config.columns.date]),
    amount: absAmount,
    description: payee,
    external_id: String(txn[config.columns.upiRefNo] || ''),
    notes: txn[config.columns.otherDetails] || '',
  };

  if (categoryName) {
    base.category_name = categoryName;
  }

  if (isExpense) {
    base.source_id = fireflyAccountId;
    base.destination_name = payee;
  } else {
    base.source_name = payee;
    base.destination_id = fireflyAccountId;
  }

  return base;
}

/**
 * Imports transactions to Firefly III via REST API
 * @param {Array} transactions - Raw Paytm transaction records
 * @param {Object} config - Configuration object
 * @param {string} fireflyAccountId - Firefly III asset account ID
 * @returns {Promise<{imported: number, duplicates: number, errors: number}>}
 */
async function importToFirefly(transactions, config, fireflyAccountId) {
  if (!fireflyAccountId) {
    throw new Error(
      'Firefly account ID is required. Set FIREFLY_ACCOUNT_ID or FIREFLY_ACCOUNT_MAP env var.'
    );
  }

  const summary = { imported: 0, duplicates: 0, errors: 0 };
  const baseURL = config.fireflyURL.replace(/\/+$/, '');

  log.info('firefly_import_start', {
    url: baseURL,
    transactionCount: transactions.length,
    accountId: fireflyAccountId,
  });

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];
    const fireflyTxn = transformToFirefly(txn, config, fireflyAccountId);

    log.debug('firefly_posting_transaction', {
      index: i + 1,
      total: transactions.length,
      type: fireflyTxn.type,
      amount: fireflyTxn.amount,
      description: fireflyTxn.description,
      date: fireflyTxn.date,
      external_id: fireflyTxn.external_id,
      category_name: fireflyTxn.category_name || null,
    });

    try {
      const response = await fetch(`${baseURL}/api/v1/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.fireflyToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          apply_rules: true,
          error_if_duplicate_hash: true,
          transactions: [fireflyTxn],
        }),
      });

      if (response.ok) {
        summary.imported++;
        log.debug('firefly_transaction_created', { index: i + 1, external_id: fireflyTxn.external_id });
      } else if (response.status === 422) {
        // Duplicate transaction — safe to skip
        summary.duplicates++;
        log.debug('firefly_duplicate_skipped', { index: i + 1, external_id: fireflyTxn.external_id });
      } else {
        summary.errors++;
        const body = await response.text();
        log.error('firefly_transaction_failed', {
          status: response.status,
          external_id: fireflyTxn.external_id,
          response: body,
        });
      }
    } catch (error) {
      summary.errors++;
      log.error('firefly_transaction_error', {
        external_id: fireflyTxn.external_id,
        error: error.message,
      });
    }
  }

  log.info('firefly_import_complete', summary);
  return summary;
}

module.exports = { transformToFirefly, importToFirefly };
