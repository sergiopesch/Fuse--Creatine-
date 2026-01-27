/**
 * DynamoDB Client
 * ===============
 *
 * Centralized DynamoDB client with connection management,
 * error handling, and utility functions.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
  BatchGetCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'fuse-main';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-2';

// Table indexes
const INDEXES = {
  GSI1: 'GSI1',
  GSI2: 'GSI2',
};

// =============================================================================
// CLIENT SETUP
// =============================================================================

let client = null;
let docClient = null;

function getClient() {
  if (!client) {
    const config = {
      region: AWS_REGION,
    };

    // For local development with DynamoDB Local
    if (process.env.DYNAMODB_ENDPOINT) {
      config.endpoint = process.env.DYNAMODB_ENDPOINT;
      config.credentials = {
        accessKeyId: 'local',
        secretAccessKey: 'local',
      };
    }

    client = new DynamoDBClient(config);

    // Document client with marshalling options
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }

  return docClient;
}

// =============================================================================
// KEY GENERATION HELPERS
// =============================================================================

/**
 * Generate primary key for an entity
 */
function pk(prefix, id) {
  return `${prefix}#${id}`;
}

/**
 * Generate sort key
 */
function sk(...parts) {
  return parts.join('#');
}

/**
 * Generate ISO timestamp for sort keys
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Generate date string (YYYY-MM-DD)
 */
function dateKey(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * Generate month string (YYYY-MM)
 */
function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

/**
 * Generate UUID
 */
function uuid() {
  return crypto.randomUUID();
}

// =============================================================================
// CORE OPERATIONS
// =============================================================================

/**
 * Get a single item by primary key
 */
async function getItem(key, options = {}) {
  const client = getClient();

  const params = {
    TableName: TABLE_NAME,
    Key: key,
    ...options,
  };

  try {
    const result = await client.send(new GetCommand(params));
    return result.Item || null;
  } catch (error) {
    console.error('[DB] GetItem error:', error.message);
    throw new DatabaseError('Failed to get item', error);
  }
}

/**
 * Put an item (create or replace)
 */
async function putItem(item, options = {}) {
  const client = getClient();

  const params = {
    TableName: TABLE_NAME,
    Item: item,
    ...options,
  };

  try {
    await client.send(new PutCommand(params));
    return item;
  } catch (error) {
    console.error('[DB] PutItem error:', error.message);
    throw new DatabaseError('Failed to put item', error);
  }
}

/**
 * Update specific attributes of an item
 */
async function updateItem(key, updates, options = {}) {
  const client = getClient();

  // Build update expression
  const updateParts = [];
  const expressionNames = {};
  const expressionValues = {};

  Object.entries(updates).forEach(([attr, value], index) => {
    const nameKey = `#attr${index}`;
    const valueKey = `:val${index}`;
    updateParts.push(`${nameKey} = ${valueKey}`);
    expressionNames[nameKey] = attr;
    expressionValues[valueKey] = value;
  });

  const params = {
    TableName: TABLE_NAME,
    Key: key,
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
    ...options,
  };

  try {
    const result = await client.send(new UpdateCommand(params));
    return result.Attributes;
  } catch (error) {
    console.error('[DB] UpdateItem error:', error.message);
    throw new DatabaseError('Failed to update item', error);
  }
}

/**
 * Delete an item
 */
async function deleteItem(key, options = {}) {
  const client = getClient();

  const params = {
    TableName: TABLE_NAME,
    Key: key,
    ReturnValues: 'ALL_OLD',
    ...options,
  };

  try {
    const result = await client.send(new DeleteCommand(params));
    return result.Attributes || null;
  } catch (error) {
    console.error('[DB] DeleteItem error:', error.message);
    throw new DatabaseError('Failed to delete item', error);
  }
}

/**
 * Query items
 */
async function query(params) {
  const client = getClient();

  const queryParams = {
    TableName: TABLE_NAME,
    ...params,
  };

  try {
    const result = await client.send(new QueryCommand(queryParams));
    return {
      items: result.Items || [],
      count: result.Count || 0,
      lastKey: result.LastEvaluatedKey,
    };
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    throw new DatabaseError('Failed to query items', error);
  }
}

/**
 * Query with pagination support
 */
async function queryAll(params, maxItems = 1000) {
  const allItems = [];
  let lastKey = null;

  do {
    const result = await query({
      ...params,
      ExclusiveStartKey: lastKey,
    });

    allItems.push(...result.items);
    lastKey = result.lastKey;

    if (allItems.length >= maxItems) {
      break;
    }
  } while (lastKey);

  return allItems.slice(0, maxItems);
}

/**
 * Query on GSI1
 */
async function queryGSI1(keyCondition, options = {}) {
  return query({
    IndexName: INDEXES.GSI1,
    ...keyCondition,
    ...options,
  });
}

/**
 * Query on GSI2
 */
async function queryGSI2(keyCondition, options = {}) {
  return query({
    IndexName: INDEXES.GSI2,
    ...keyCondition,
    ...options,
  });
}

/**
 * Batch write items (up to 25 at a time)
 */
async function batchWrite(items, deleteKeys = []) {
  const client = getClient();

  const requests = [
    ...items.map(item => ({ PutRequest: { Item: item } })),
    ...deleteKeys.map(key => ({ DeleteRequest: { Key: key } })),
  ];

  // Split into chunks of 25
  const chunks = [];
  for (let i = 0; i < requests.length; i += 25) {
    chunks.push(requests.slice(i, i + 25));
  }

  try {
    for (const chunk of chunks) {
      await client.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: chunk,
          },
        })
      );
    }
  } catch (error) {
    console.error('[DB] BatchWrite error:', error.message);
    throw new DatabaseError('Failed to batch write', error);
  }
}

/**
 * Batch get items (up to 100 at a time)
 */
async function batchGet(keys) {
  const client = getClient();

  // Split into chunks of 100
  const chunks = [];
  for (let i = 0; i < keys.length; i += 100) {
    chunks.push(keys.slice(i, i + 100));
  }

  const allItems = [];

  try {
    for (const chunk of chunks) {
      const result = await client.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: { Keys: chunk },
          },
        })
      );
      allItems.push(...(result.Responses?.[TABLE_NAME] || []));
    }
    return allItems;
  } catch (error) {
    console.error('[DB] BatchGet error:', error.message);
    throw new DatabaseError('Failed to batch get', error);
  }
}

/**
 * Transactional write (up to 100 items)
 */
async function transactWrite(operations) {
  const client = getClient();

  const transactItems = operations.map(op => {
    if (op.put) {
      return {
        Put: {
          TableName: TABLE_NAME,
          Item: op.put,
          ...op.condition,
        },
      };
    }
    if (op.update) {
      return {
        Update: {
          TableName: TABLE_NAME,
          Key: op.update.key,
          UpdateExpression: op.update.expression,
          ExpressionAttributeNames: op.update.names,
          ExpressionAttributeValues: op.update.values,
          ...op.condition,
        },
      };
    }
    if (op.delete) {
      return {
        Delete: {
          TableName: TABLE_NAME,
          Key: op.delete,
          ...op.condition,
        },
      };
    }
    if (op.conditionCheck) {
      return {
        ConditionCheck: {
          TableName: TABLE_NAME,
          Key: op.conditionCheck.key,
          ConditionExpression: op.conditionCheck.condition,
          ExpressionAttributeNames: op.conditionCheck.names,
          ExpressionAttributeValues: op.conditionCheck.values,
        },
      };
    }
    throw new Error('Invalid transaction operation');
  });

  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      })
    );
  } catch (error) {
    console.error('[DB] TransactWrite error:', error.message);
    throw new DatabaseError('Transaction failed', error);
  }
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

class DatabaseError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DatabaseError';
    this.cause = cause;
    this.code = cause?.name || 'UNKNOWN';
  }

  isConditionalCheckFailed() {
    return this.code === 'ConditionalCheckFailedException';
  }

  isThrottled() {
    return (
      this.code === 'ProvisionedThroughputExceededException' ||
      this.code === 'ThrottlingException'
    );
  }

  isNotFound() {
    return this.code === 'ResourceNotFoundException';
  }
}

// =============================================================================
// TTL HELPERS
// =============================================================================

/**
 * Generate TTL timestamp (seconds since epoch)
 */
function ttl(daysFromNow) {
  return Math.floor(Date.now() / 1000) + daysFromNow * 24 * 60 * 60;
}

/**
 * TTL presets
 */
const TTL = {
  ONE_DAY: () => ttl(1),
  ONE_WEEK: () => ttl(7),
  ONE_MONTH: () => ttl(30),
  THREE_MONTHS: () => ttl(90),
  ONE_YEAR: () => ttl(365),
  SEVEN_YEARS: () => ttl(365 * 7), // Compliance retention
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Client
  getClient,

  // Table config
  TABLE_NAME,
  INDEXES,

  // Key helpers
  pk,
  sk,
  timestamp,
  dateKey,
  monthKey,
  uuid,

  // Core operations
  getItem,
  putItem,
  updateItem,
  deleteItem,
  query,
  queryAll,
  queryGSI1,
  queryGSI2,
  batchWrite,
  batchGet,
  transactWrite,

  // TTL
  ttl,
  TTL,

  // Errors
  DatabaseError,
};
