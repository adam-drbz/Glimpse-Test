import { apiClient } from './client';
import config from './config.json';

export async function listRecords(tableName, params = {}) {
  const { appId } = config;

  const queryParams = new URLSearchParams();

  if (params.filter) {
    queryParams.append('filter', JSON.stringify(params.filter));
  }
  if (params.sort) {
    queryParams.append('sort', params.sort);
  }
  if (params.join) {
    queryParams.append('join', params.join);
  }
  if (params.fields) {
    queryParams.append('fields', params.fields);
  }
  if (params.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params.offset !== undefined) {
    queryParams.append('offset', params.offset.toString());
  }
  if (params.page) {
    queryParams.append('page', params.page.toString());
  }

  const queryString = queryParams.toString();
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records${queryString ? `?${queryString}` : ''}`;

  return apiClient.get(endpoint);
}

export async function getRecord(tableName, recordId, join) {
  const { appId } = config;
  const queryString = join ? `?join=${join}` : '';
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}${queryString}`;

  return apiClient.get(endpoint);
}

export async function createRecord(tableName, data) {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records`;

  return apiClient.post(endpoint, data);
}

export async function updateRecord(tableName, recordId, data) {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}`;

  return apiClient.put(endpoint, data);
}

export async function deleteRecord(tableName, recordId) {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/${tableName}/records/${recordId}`;

  return apiClient.delete(endpoint);
}

export async function aggregateRecords(tableName, params) {
  const { appId } = config;

  const queryParams = new URLSearchParams();
  queryParams.append('function', params.function);

  if (params.field) {
    queryParams.append('field', params.field);
  }
  if (params.groupBy) {
    queryParams.append('groupBy', params.groupBy);
  }
  if (params.filter) {
    queryParams.append('filter', JSON.stringify(params.filter));
  }

  const endpoint = `/v1/apps/${appId}/tables/${tableName}/aggregate?${queryParams.toString()}`;

  return apiClient.get(endpoint);
}

export async function executeQuery(params) {
  const { appId } = config;
  const endpoint = `/v1/apps/${appId}/tables/query`;

  return apiClient.post(endpoint, params);
}
