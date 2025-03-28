import React from 'react';
import { renderWithRedux, patientlyWaitFor, within, fireEvent, act } from 'react-testing-lib-wrapper';
import { nockInstance, assertNockRequest, mockForemanAutocomplete } from '../../../../../test-utils/nockWrapper';
import { foremanApi } from '../../../../../services/api';
import { HOST_ERRATA_KEY, ERRATA_SEARCH_QUERY } from '../ErrataTab/HostErrataConstants';
import { REX_FEATURES } from '../RemoteExecutionConstants';
import { ErrataTab } from '../ErrataTab/ErrataTab.js';
import mockErrataData from './errata.fixtures.json';
import mockResolveErrataTask from './resolveErrata.fixtures.json';

jest.mock('../../hostDetailsHelpers', () => ({
  ...jest.requireActual('../../hostDetailsHelpers'),
  userPermissionsFromHostDetails: () => ({
    create_job_invocations: true,
    edit_hosts: true,
  }),
}));

const contentFacetAttributes = {
  id: 11,
  uuid: 'e5761ea3-4117-4ecf-83d0-b694f99b389e',
  content_view_default: false,
  contentView: {
    rolling: false,
  },
  lifecycle_environment_library: false,
  errata_counts: {
    total: 3,
  },
};

const cfWithErrataTotal = total => ({
  ...contentFacetAttributes,
  errata_counts: {
    total,
  },
});

const cfNoErrata = cfWithErrataTotal(0);

const hostName = 'foo.example.com';

const renderOptions = (facetAttributes = contentFacetAttributes) => ({
  apiNamespace: HOST_ERRATA_KEY,
  initialState: {
    API: {
      HOST_DETAILS: {
        response: {
          id: 1,
          name: hostName,
          errata_status_label: 'Security errata applicable',
          errata_status: 2,
          content_facet_attributes: { ...facetAttributes },
        },
        status: 'RESOLVED',
      },
    },
  },
});

const makeMockErrata = ({ pageSize = 20, total = 100, page = 1 }) => {
  const mockErrataResults = [];
  for (let i = (page * 1000); i < (page * 1000) + pageSize; i += 1) {
    mockErrataResults.push({
      id: i,
      severity: 'Important',
      title: `Errata${i}`,
      type: (i % 2 === 0) ? 'security' : 'enhancement',
      host_id: 1,
      errata_id: `Errata${i}`,
      bugs: [],
      cves: [],
      packages: [],
      module_streams: [],
      installable: true,
    });
  }

  return {
    total,
    subtotal: total,
    selectable: total,
    page,
    per_page: pageSize,
    error: null,
    search: null,
    results: mockErrataResults,
  };
};

const hostErrata = foremanApi.getApiUrl('/hosts/1/errata');
const autocompleteUrl = '/hosts/1/errata/auto_complete_search';
const baseQuery = {
  include_applicable: false,
  per_page: 20,
  page: 1,
};
const baseQueryWithSort = {
  ...baseQuery,
  sort_by: 'errata_id',
  sort_order: 'asc',
};
const defaultQuery = { ...baseQueryWithSort, search: '' };
const page2Query = { ...baseQueryWithSort, page: 2 };
const jobInvocations = foremanApi.getApiUrl('/job_invocations');

let firstErrata;
let thirdErrata;

beforeEach(() => {
  const { results } = mockErrataData;
  [firstErrata, , thirdErrata] = results;
});

test('Can call API for errata and show on screen on page load', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  // return tracedata results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrataData);

  const { getAllByText } = renderWithRedux(<ErrataTab />, renderOptions());
  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText(firstErrata.severity)[0]).toBeInTheDocument());
  // Assert request was made and completed, see helper function
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Can handle no errata being present', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);

  const noResults = {
    total: 0,
    subtotal: 0,
    page: 1,
    per_page: 20,
    results: [],
  };

  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, noResults);

  const { queryByText } = renderWithRedux(<ErrataTab />, renderOptions(cfNoErrata));

  // Assert that there are not any errata showing on the screen.
  await patientlyWaitFor(() => expect(queryByText('This host has errata that are applicable, but not installable. Adjust your filters and try again.')).toBeInTheDocument());
  // Assert request was made and completed, see helper function
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Can display expanded errata details', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);

  // return tracedata results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrataData);

  const {
    getByText,
    queryByText,
    getAllByText,
    getAllByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions());

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText(firstErrata.severity)[0]).toBeInTheDocument());
  const firstExpansion = getAllByLabelText('Details')[0];

  firstExpansion.click();
  expect(getAllByText('CVEs').length).toBeGreaterThan(0);
  // the errata details should now be visible
  expect(getByText(firstErrata.summary)).toBeVisible();

  const cveTreeItem = getAllByText('CVEs')[0];
  expect(cveTreeItem).toBeVisible();
  cveTreeItem.click();
  // the CVE should now be visible
  expect(getByText(firstErrata.cves[0].cve_id)).toBeInTheDocument();
  cveTreeItem.click();
  // the CVE should now have disappeared
  expect(queryByText(firstErrata.cves[0].cve_id)).not.toBeInTheDocument();

  firstExpansion.click();
  // the errata details should now be gone
  expect(queryByText(firstErrata.summary)).not.toBeInTheDocument();
  // Assert request was made and completed, see helper function
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Can select one errata', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);

  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrataData);

  const {
    queryByText,
    getAllByText,
    getByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions());

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText(firstErrata.severity)[0]).toBeInTheDocument());

  expect(queryByText('1 selected')).not.toBeInTheDocument();

  const firstCheckBox = getByLabelText('Select row 0');
  firstCheckBox.click();

  const selectAllCheckbox = getByLabelText('Select all');
  expect(selectAllCheckbox.checked).toEqual(false);

  expect(queryByText('1 selected')).toBeInTheDocument();

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Can select all errata across pages through checkbox', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({ page: 1 });
  // return errata data results when we look for errata

  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const scope2 = nockInstance
    .get(hostErrata)
    .query(page2Query)
    .reply(200, makeMockErrata({ page: 2 }));

  const {
    queryByText,
    getAllByText,
    getByLabelText,
    getAllByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  const selectAllCheckbox = getByLabelText('Select all');
  selectAllCheckbox.click();
  expect(queryByText(`${mockErrata.total} selected`)).toBeInTheDocument();
  expect(getByLabelText('Select row 0').checked).toEqual(true);

  getAllByLabelText('Go to next page')[0].click();
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(getByLabelText('Select row 0').checked).toEqual(true);

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done();
  assertNockRequest(scope2);
  done(); // Pass jest callback to confirm test is done
});

test('Can deselect all errata across pages through checkbox', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({ page: 1 });
  // return errata data results when we look for errata

  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const scope2 = nockInstance
    .get(hostErrata)
    .query(page2Query)
    .reply(200, makeMockErrata({ page: 2 }));

  const {
    queryByText,
    getAllByText,
    getByLabelText,
    getAllByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  const selectAllCheckbox = getByLabelText('Select all');
  selectAllCheckbox.click();
  expect(queryByText(`${mockErrata.total} selected`)).toBeInTheDocument();
  expect(getByLabelText('Select row 0').checked).toEqual(true);

  selectAllCheckbox.click();
  expect(queryByText(`${mockErrata.total} selected`)).not.toBeInTheDocument();
  expect(getByLabelText('Select row 0').checked).toEqual(false);

  getAllByLabelText('Go to next page')[0].click();
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(getByLabelText('Select row 0').checked).toEqual(false);

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
  assertNockRequest(scope2);
  done();
});


test('Can select & deselect errata across pages', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);

  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, makeMockErrata({ page: 1 }));

  const scope2 = nockInstance
    .get(hostErrata)
    .query(page2Query)
    .reply(200, makeMockErrata({ page: 2 }));

  const {
    queryByText,
    getAllByText,
    getByLabelText,
    getAllByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(100)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  getByLabelText('Select row 0').click();
  getByLabelText('Select row 1').click();

  getAllByLabelText('Go to next page')[0].click();
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  getByLabelText('Select row 0').click();
  getByLabelText('Select row 1').click();

  expect(queryByText('4 selected')).toBeInTheDocument();

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
  assertNockRequest(scope2);
  done();
});

test('Can select & de-select all errata through selectDropDown', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    getByText,
    queryByText,
    getAllByText,
    getByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  const selectDropDown = getByLabelText('Select');
  selectDropDown.click();

  const selectAll = getByText(`Select all (${mockErrata.total})`);
  expect(selectAll).toBeInTheDocument();
  selectAll.click();

  expect(queryByText(`${mockErrata.total} selected`)).toBeInTheDocument();
  expect(getByLabelText('Select row 0').checked).toEqual(true);

  selectDropDown.click();
  const selectNone = getByText('Select none (0)');
  selectNone.click();

  expect(queryByText(`${mockErrata.total} selected`)).not.toBeInTheDocument();
  expect(getByLabelText('Select row 0').checked).toEqual(false);

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Can de-select items in select all mode across pages', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({ page: 1 });

  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const scope2 = nockInstance
    .get(hostErrata)
    .query({ ...baseQueryWithSort, page: 1 })
    .reply(200, makeMockErrata({ page: 2 }));

  const scope3 = nockInstance
    .get(hostErrata)
    .query(page2Query)
    .reply(200, makeMockErrata({ page: 2 }));

  const {
    queryByText,
    getAllByText,
    getByLabelText,
    getAllByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  const selectAllCheckbox = getByLabelText('Select all');
  selectAllCheckbox.click();
  expect(queryByText(`${mockErrata.total} selected`)).toBeInTheDocument();

  expect(getByLabelText('Select row 0').checked).toEqual(true);
  getByLabelText('Select row 0').click(); // de select

  expect(queryByText(`${mockErrata.total - 1} selected`)).toBeInTheDocument();
  expect(getByLabelText('Select row 0').checked).toEqual(false);

  // goto next page
  getAllByLabelText('Go to next page')[0].click();
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  expect(getByLabelText('Select row 0').checked).toEqual(true);
  getByLabelText('Select row 0').click(); // de select

  expect(queryByText(`${mockErrata.total - 2} selected`)).toBeInTheDocument();
  expect(getByLabelText('Select row 0').checked).toEqual(false);

  // goto previous page
  getAllByLabelText('Go to previous page')[0].click();
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  expect(getByLabelText('Select row 0').checked).toEqual(false);
  expect(getByLabelText('Select row 1').checked).toEqual(true);
  getByLabelText('Select row 1').click(); // de select

  expect(queryByText(`${mockErrata.total - 3} selected`)).toBeInTheDocument();
  expect(getByLabelText('Select row 1').checked).toEqual(false);

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
  assertNockRequest(scope2);
  done();
  assertNockRequest(scope3);
  done();
});

test('Can select page and select only items on the page', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    getByText,
    queryByText,
    getAllByText,
    getByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  const selectDropDown = getByLabelText('Select');
  selectDropDown.click();

  const selectPage = getByText('Select page (20)');
  expect(selectPage).toBeInTheDocument();
  selectPage.click();

  expect(queryByText('20 selected')).toBeInTheDocument();
  expect(getByLabelText('Select row 0').checked).toEqual(true);

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Select all is disabled if all rows are selected', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    getByText,
    queryByText,
    getAllByText,
    getByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  const selectDropDown = getByLabelText('Select');
  selectDropDown.click();

  const selectAll = getByText(`Select all (${mockErrata.total})`);
  expect(selectAll).toBeInTheDocument();
  expect(selectAll).toHaveAttribute('aria-disabled', 'false');
  selectAll.click();

  expect(queryByText(`${mockErrata.total} selected`)).toBeInTheDocument();

  // click the dropdown again and  make sure select all is disabled
  selectDropDown.click();
  expect(getByText(`Select all (${mockErrata.total})`)).toHaveAttribute('aria-disabled', 'true');
  expect(getByText('Select page (20)')).toHaveAttribute('aria-disabled', 'true');
  expect(getByText('Select none (0)')).toHaveAttribute('aria-disabled', 'false');

  // Select none
  getByText('Select none (0)').click();
  selectDropDown.click();
  expect(getByText(`Select all (${mockErrata.total})`)).toHaveAttribute('aria-disabled', 'false');
  expect(getByText('Select page (20)')).toHaveAttribute('aria-disabled', 'false');
  expect(getByText('Select none (0)')).toHaveAttribute('aria-disabled', 'true');

  // Select page
  getByText('Select page (20)').click();
  selectDropDown.click();
  expect(getByText(`Select all (${mockErrata.total})`)).toHaveAttribute('aria-disabled', 'false');
  expect(getByText('Select page (20)')).toHaveAttribute('aria-disabled', 'true');
  expect(getByText('Select none (0)')).toHaveAttribute('aria-disabled', 'false');

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Toggle Group shows if it\'s not the default content view or library enviroment', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    queryByLabelText,
    getAllByText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(queryByLabelText('Installable Errata')).toBeInTheDocument();
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Toggle Group shows if it\'s the default content view but non-library environment', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const options = renderOptions({
    ...cfWithErrataTotal(mockErrata.total),
    content_view_default: true,
  });
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    queryByLabelText,
    getAllByText,
  } = renderWithRedux(<ErrataTab />, options);

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(queryByLabelText('Installable Errata')).toBeInTheDocument();
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Toggle Group shows if it\'s the library environment but non-default content view', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const options = renderOptions({
    ...cfWithErrataTotal(mockErrata.total),
    lifecycle_environment_library: true,
  });

  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    queryByLabelText,
    getAllByText,
  } = renderWithRedux(<ErrataTab />, options);

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(queryByLabelText('Installable Errata')).toBeInTheDocument();
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Toggle Group does not show if it\'s the default content view and library environment', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const options = renderOptions({
    ...cfWithErrataTotal(mockErrata.total),
    content_view_default: true,
    lifecycle_environment_library: true,
  });
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    queryByLabelText,
    getAllByText,
  } = renderWithRedux(<ErrataTab />, options);

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(queryByLabelText('Installable Errata')).not.toBeInTheDocument();
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Toggle Group does not show if it\'s a rolling content view and library environment', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const options = renderOptions({
    ...cfWithErrataTotal(mockErrata.total),
    contentView: {
      rolling: true,
    },
    lifecycle_environment_library: true,
  });
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    queryByLabelText,
    getAllByText,
  } = renderWithRedux(<ErrataTab />, options);

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(queryByLabelText('Installable Errata')).not.toBeInTheDocument();
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope, done); // Pass jest callback to confirm test is done
});

test('Selection is disabled for errata which are applicable but not installable', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  firstErrata.installable = false;
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrataData);

  const {
    getAllByText,
    getByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(3)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText(firstErrata.severity)[0]).toBeInTheDocument());
  expect(getByLabelText('Select row 0')).toBeDisabled();
  expect(getByLabelText('Select row 1')).not.toBeDisabled();

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Can select only installable errata across pages through checkbox', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({ page: 1 });
  const first = mockErrata.results[0];
  first.installable = false;
  mockErrata.selectable = mockErrata.total - 1;
  // return errata data results when we look for errata

  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const scope2 = nockInstance
    .get(hostErrata)
    .query(page2Query)
    .reply(200, makeMockErrata({ page: 2 }));

  const {
    queryByText,
    getAllByText,
    getByLabelText,
    getAllByLabelText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  const selectAllCheckbox = getByLabelText('Select all');
  selectAllCheckbox.click();
  expect(queryByText(`${mockErrata.selectable} selected`)).toBeInTheDocument();
  expect(queryByText(`${mockErrata.total} selected`)).not.toBeInTheDocument();
  expect(getByLabelText('Select row 0')).toBeDisabled();
  getAllByLabelText('Go to next page')[0].click();
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(getByLabelText('Select row 0').checked).toEqual(true);

  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done();
  assertNockRequest(scope2);
  done(); // Pass jest callback to confirm test is done
});

test('Can toggle with the Toggle Group ', async (done) => {
  // Setup autocomplete with mockForemanAutoComplete since we aren't adding /katello
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  // return errata data results when we look for errata
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const {
    queryByLabelText,
    getByText,
    getAllByText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(mockErrata.total)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  expect(queryByLabelText('Installable Errata')).toBeInTheDocument();
  expect(getByText('Applicable')).toBeInTheDocument();
  expect(getByText('Applicable').parentElement).toHaveAttribute('aria-pressed', 'false');
  expect(getAllByText('Installable')[0].parentElement).toHaveAttribute('aria-pressed', 'true');
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done(); // Pass jest callback to confirm test is done
});

test('Can filter by errata type', async (done) => {
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrataData);

  const scope2 = nockInstance
    .get(hostErrata)
    .query({ ...defaultQuery, type: 'security' })
    .reply(200, { ...mockErrataData, results: [firstErrata] });

  const {
    queryByText,
    queryByLabelText,
    getByRole,
    getAllByText,
    getByText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(3)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  // the Bugfix text in the table is just a text node, while the dropdown is a button
  expect(getByText('Bugfix', { ignore: ['button', 'title'] })).toBeInTheDocument();
  expect(getByText('Enhancement', { ignore: ['button', 'title'] })).toBeInTheDocument();
  const typeContainer = queryByLabelText('select Type container', { ignore: 'th' });
  const typeDropdown = within(typeContainer).queryByText('Type');
  expect(typeDropdown).toBeInTheDocument();
  fireEvent.click(typeDropdown);
  const security = getByRole('option', { name: 'select Security' });
  fireEvent.click(security);
  await patientlyWaitFor(() => {
    expect(queryByText('Bugfix')).not.toBeInTheDocument();
    expect(queryByText('Enhancement')).not.toBeInTheDocument();
  });


  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  assertNockRequest(scope2);
  done(); // Pass jest callback to confirm test is done
});

test('Can filter by severity', async (done) => {
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrataData);

  const scope2 = nockInstance
    .get(hostErrata)
    .query({ ...defaultQuery, severity: 'Important' })
    .reply(200, { ...mockErrataData, results: [thirdErrata] });

  const {
    queryByText,
    getByRole,
    queryByLabelText,
    getAllByText,
    getByText,
  } = renderWithRedux(<ErrataTab />, renderOptions(cfWithErrataTotal(3)));

  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  // the Bugfix text in the table is just a text node, while the dropdown is a button
  expect(getByText('Moderate', { ignore: ['button', 'title'] })).toBeInTheDocument();
  expect(getByText('Important', { ignore: ['.pf-v5-c-select__toggle-text', 'title'] })).toBeInTheDocument();
  expect(getByText('Critical', { ignore: ['button', 'title'] })).toBeInTheDocument();
  const severityContainer = queryByLabelText('select Severity container', { ignore: 'th' });
  const severityDropdown = within(severityContainer).queryByText('Severity');
  expect(severityDropdown).toBeInTheDocument();
  fireEvent.click(severityDropdown);
  const important = getByRole('option', { name: 'select Important' });
  fireEvent.click(important);
  await patientlyWaitFor(() => {
    expect(queryByText('Moderate', { ignore: ['.pf-v5-c-select__toggle-text'] })).not.toBeInTheDocument();
    expect(queryByText('Critical', { ignore: ['.pf-v5-c-select__toggle-text'] })).not.toBeInTheDocument();
  });
  await patientlyWaitFor(() => {
    expect(getByText('Important', { ignore: ['.pf-v5-c-select__toggle-text', 'title'] })).toBeInTheDocument();
  });


  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  assertNockRequest(scope2);
  done(); // Pass jest callback to confirm test is done
});

test('Can bulk apply via remote execution', async (done) => {
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const { results } = mockErrata;
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  // eslint-disable-next-line camelcase
  const jobInvocationBody = ({ job_invocation: { inputs, feature, search_query } }) =>
    inputs[ERRATA_SEARCH_QUERY] === `errata_id ^ (${results[0].errata_id},${results[1].errata_id})` &&
    feature === REX_FEATURES.KATELLO_HOST_ERRATA_INSTALL_BY_SEARCH &&
    // eslint-disable-next-line camelcase
    search_query === `name ^ (${hostName})`;

  const resolveErrataScope = nockInstance
    .post(jobInvocations, jobInvocationBody)
    .reply(201, mockResolveErrataTask);

  const { getAllByText, getByLabelText, queryByText } = renderWithRedux(
    <ErrataTab />,
    renderOptions(cfWithErrataTotal(mockErrata.total)),
  );
  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  getByLabelText('Select row 0').click();
  getByLabelText('Select row 1').click();

  const actionMenu = getByLabelText('expand_errata_toggle');
  actionMenu.click();
  const viaRexAction = queryByText('Apply via remote execution');
  expect(viaRexAction).toBeInTheDocument();
  await act(async () => {
    viaRexAction.click();
  });

  assertNockRequest(autocompleteScope);
  assertNockRequest(resolveErrataScope);
  assertNockRequest(scope);
  done();
});

test('Can select all, exclude and bulk apply via remote execution', async (done) => {
  // This is the same test as above,
  // but using the table action bar instead of the Restart app button
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const { results } = mockErrata;
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const jobInvocationBody = ({ job_invocation: { inputs } }) =>
    inputs[ERRATA_SEARCH_QUERY] === `errata_id !^ (${results[0].errata_id})`;

  const resolveErrataScope = nockInstance
    .post(jobInvocations, jobInvocationBody)
    .reply(201, mockResolveErrataTask);

  const { getAllByText, getByLabelText, queryByText } = renderWithRedux(
    <ErrataTab />,
    renderOptions(cfWithErrataTotal(mockErrata.total)),
  );
  // Assert that the errata are now showing on the screen, but wait for them to appear.
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  const selectAllCheckbox = getByLabelText('Select all');
  selectAllCheckbox.click();

  getByLabelText('Select row 0').click(); // de select

  const actionMenu = getByLabelText('expand_errata_toggle');
  actionMenu.click();
  const viaRexAction = queryByText('Apply via remote execution');
  expect(viaRexAction).toBeInTheDocument();
  await act(async () => {
    viaRexAction.click();
  });

  assertNockRequest(autocompleteScope);
  assertNockRequest(resolveErrataScope);
  assertNockRequest(scope);
  done();
});

test('Can apply errata in bulk via customized remote execution', async (done) => {
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const { results } = mockErrata;
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const { getAllByText, getByLabelText, queryByText } = renderWithRedux(
    <ErrataTab />,
    renderOptions(cfWithErrataTotal(mockErrata.total)),
  );

  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());

  getByLabelText('Select row 0').click();
  getByLabelText('Select row 1').click();
  const errata = `${results[0].errata_id},${results[1].errata_id}`;
  const feature = REX_FEATURES.KATELLO_HOST_ERRATA_INSTALL_BY_SEARCH;
  const actionMenu = getByLabelText('expand_errata_toggle');
  actionMenu.click();
  const viaRexAction = queryByText('Apply via customized remote execution');
  expect(viaRexAction).toBeInTheDocument();
  expect(viaRexAction).toHaveAttribute(
    'href',
    `/job_invocations/new?feature=${feature}&search=name%20%5E%20(${hostName})&inputs%5BErrata%20search%20query%5D=errata_id%20%5E%20(${errata})`,
  );

  await act(async () => {
    viaRexAction.click();
  });
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done();
});

test('Can apply a single erratum to the host via remote execution', async (done) => {
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const { results } = mockErrata;
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const jobInvocationBody = ({ job_invocation: { inputs } }) =>
    inputs[ERRATA_SEARCH_QUERY] === `errata_id = ${results[0].errata_id}`;

  const resolveErrataScope = nockInstance
    .post(jobInvocations, jobInvocationBody)
    .reply(201, mockResolveErrataTask);

  const { getByText, getAllByText, getByLabelText } = renderWithRedux(
    <ErrataTab />,
    renderOptions(cfWithErrataTotal(mockErrata.total)),
  );
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  const erratumActionMenu = within(getByLabelText('Select row 0').closest('tr')).getByLabelText('Kebab toggle');
  expect(erratumActionMenu).toHaveAttribute('aria-label', 'Kebab toggle');
  await act(async () => {
    erratumActionMenu.click();
  });

  let viaRexAction;
  await patientlyWaitFor(() => {
    viaRexAction = getByText('Apply via remote execution');
    expect(viaRexAction).toBeInTheDocument();
  });
  await act(async () => {
    viaRexAction.click();
  });

  assertNockRequest(autocompleteScope);
  assertNockRequest(resolveErrataScope);
  assertNockRequest(scope);
  done();
});

test('Can apply a single erratum to the host via customized remote execution', async (done) => {
  const autocompleteScope = mockForemanAutocomplete(nockInstance, autocompleteUrl);
  const mockErrata = makeMockErrata({});
  const { results } = mockErrata;
  const { errata_id: errataId } = results[0];
  const feature = REX_FEATURES.KATELLO_HOST_ERRATA_INSTALL_BY_SEARCH;
  const scope = nockInstance
    .get(hostErrata)
    .query(defaultQuery)
    .reply(200, mockErrata);

  const { getByText, getAllByText, getByLabelText } = renderWithRedux(
    <ErrataTab />,
    renderOptions(cfWithErrataTotal(mockErrata.total)),
  );
  await patientlyWaitFor(() => expect(getAllByText('Important')[0]).toBeInTheDocument());
  const erratumActionMenu = within(getByLabelText('Select row 0').closest('tr')).getByLabelText('Kebab toggle');
  expect(erratumActionMenu).toHaveAttribute('aria-label', 'Kebab toggle');
  await act(async () => {
    erratumActionMenu.click();
  });
  let viaRexAction;
  await patientlyWaitFor(() => {
    viaRexAction = getByText('Apply via customized remote execution');
    expect(viaRexAction).toBeInTheDocument();
  });
  await act(async () => {
    viaRexAction.click();
  });
  expect(viaRexAction).toHaveAttribute(
    'href',
    `/job_invocations/new?feature=${feature}&search=name%20%5E%20(${hostName})&inputs%5BErrata%20search%20query%5D=errata_id%20=%20${errataId}`,
  );
  assertNockRequest(autocompleteScope);
  assertNockRequest(scope);
  done();
});
