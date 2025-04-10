import React, { useCallback, useState, useMemo } from 'react';
import useDeepCompareEffect from 'use-deep-compare-effect';
import { useSelector, useDispatch } from 'react-redux';
import {
  Split,
  SplitItem,
  ActionList,
  ActionListItem,
  Skeleton,
  Tooltip,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import {
  Dropdown,
  DropdownItem,
  KebabToggle,
  DropdownToggle,
  DropdownToggleAction,
} from '@patternfly/react-core/deprecated';
import { TimesIcon, CheckIcon } from '@patternfly/react-icons';
import {
  TableVariant,
  TableText,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  ExpandableRowContent,
} from '@patternfly/react-table';
import { isEqual } from 'lodash';
import { translate as __ } from 'foremanReact/common/I18n';
import { HOST_DETAILS_KEY } from 'foremanReact/components/HostDetails/consts';
import { selectAPIResponse } from 'foremanReact/redux/API/APISelectors';
import IsoDate from 'foremanReact/components/common/dates/IsoDate';
import { urlBuilder } from 'foremanReact/common/urlHelpers';
import { propsToCamelCase } from 'foremanReact/common/helpers';
import { useSet, useBulkSelect, useUrlParams } from 'foremanReact/components/PF4/TableIndexPage/Table/TableHooks';
import { useTableSort } from 'foremanReact/components/PF4/Helpers/useTableSort';
import SelectableDropdown from '../../../../SelectableDropdown';
import TableWrapper from '../../../../../components/Table/TableWrapper';
import { ErrataType, ErrataSeverity } from '../../../../../components/Errata';
import { getInstallableErrata } from './HostErrataActions';
import ErratumExpansionDetail from './ErratumExpansionDetail';
import ErratumExpansionContents from './ErratumExpansionContents';
import { selectHostErrataStatus } from './HostErrataSelectors';
import { HOST_ERRATA_KEY, ERRATA_TYPES, ERRATA_SEVERITIES, TYPES_TO_PARAM, SEVERITIES_TO_PARAM, PARAM_TO_FRIENDLY_NAME } from './HostErrataConstants';
import { installErrata } from '../RemoteExecutionActions';
import { errataInstallUrl } from '../customizedRexUrlHelpers';
import './ErrataTab.scss';
import hostIdNotReady, { getHostDetails } from '../../HostDetailsActions';
import {
  hasRequiredPermissions as can,
  missingRequiredPermissions as cannot,
  userPermissionsFromHostDetails,
  hostIsImageMode,
} from '../../hostDetailsHelpers';
import SortableColumnHeaders from '../../../../Table/components/SortableColumnHeaders';
import { useRexJobPolling } from '../RemoteExecutionHooks';
import { errataStatusContemplation, friendlyErrataStatus } from '../../../../Errata/errataHelpers';
import { runSubmanRepos } from '../../Cards/ContentViewDetailsCard/HostContentViewActions';
import ImageModeHostAlert from '../../../Hosts/ImageModeHostAlert';

const recalculateApplicability = ['edit_hosts'];
const invokeRexJobs = ['create_job_invocations'];
const createBookmarks = ['create_bookmarks'];

export const ErrataTab = () => {
  const hostDetails = useSelector(state => selectAPIResponse(state, 'HOST_DETAILS'));
  const {
    id: hostId,
    name: hostname,
    content_facet_attributes: contentFacetAttributes,
    errata_status: errataStatus,
    errata_status_label: errataStatusLabel,
  } = hostDetails;
  const userPermissions = userPermissionsFromHostDetails({ hostDetails });
  const showRecalculate =
    can(
      recalculateApplicability,
      userPermissions,
    );
  const contentFacet = propsToCamelCase(contentFacetAttributes ?? {});
  const dispatch = useDispatch();
  const toggleGroupStates = ['applicable', 'installable'];
  const [APPLICABLE, INSTALLABLE] = toggleGroupStates;
  const ERRATA_TYPE = __('Type');
  const ERRATA_SEVERITY = __('Severity');
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const toggleBulkAction = () => setIsBulkActionOpen(prev => !prev);
  const expandedErrata = useSet([]);
  const erratumIsExpanded = id => expandedErrata.has(id);
  const {
    type: initialType,
    severity: initialSeverity,
    show,
    searchParam,
  } = useUrlParams();
  const [toggleGroupState, setToggleGroupState] = useState(show ?? INSTALLABLE);
  const [errataTypeSelected, setErrataTypeSelected]
    = useState(PARAM_TO_FRIENDLY_NAME[initialType] ?? ERRATA_TYPE);
  const [errataSeveritySelected, setErrataSeveritySelected]
    = useState(PARAM_TO_FRIENDLY_NAME[initialSeverity] ?? ERRATA_SEVERITY);
  const activeFilters = useMemo(() =>
    [errataTypeSelected, errataSeveritySelected], [errataTypeSelected, errataSeveritySelected]);
  const defaultFilters = useMemo(() =>
    [ERRATA_TYPE, ERRATA_SEVERITY], [ERRATA_SEVERITY, ERRATA_TYPE]);

  const [isActionOpen, setIsActionOpen] = useState(false);
  const onActionToggle = () => {
    setIsActionOpen(prev => !prev);
  };

  const { allUpToDate, neededErrata } = errataStatusContemplation(errataStatus);
  const emptySearchTitle = __('No matching errata found');
  const emptySearchBody = __('Try changing your search settings.');
  const resetFiltersOnly = () => {
    setErrataTypeSelected(ERRATA_TYPE);
    setErrataSeveritySelected(ERRATA_SEVERITY);
  };

  const resetFiltersAndToggle = () => {
    resetFiltersOnly();
    setToggleGroupState(APPLICABLE);
  };

  const refreshHostDetails = () => dispatch({
    type: 'API_GET',
    payload: {
      key: HOST_DETAILS_KEY,
      url: `/api/hosts/${hostname}`,
    },
  });

  const {
    triggerJobStart: triggerRecalculate, lastCompletedJob: lastCompletedRecalculate,
  } = useRexJobPolling(() => runSubmanRepos(hostname, refreshHostDetails));

  const recalculateErrata = () => {
    setIsBulkActionOpen(false);
    triggerRecalculate();
  };

  let resetFilters = resetFiltersOnly;
  let secondaryActionTextOverride;
  let emptyContentTitle;
  let emptyContentBody;
  switch (friendlyErrataStatus(errataStatus)) {
  case 'All up to date':
    emptyContentTitle = __('All up to date');
    emptyContentBody = __('No action is needed because there are no applicable errata for this host.');
    resetFilters = recalculateErrata;
    secondaryActionTextOverride = __('Refresh errata applicability');
    break;
  case 'Needed':
    emptyContentTitle = __('No matching errata found');
    emptyContentBody = __('This host has errata that are applicable, but not installable. Adjust your filters and try again.');
    resetFilters = resetFiltersAndToggle;
    secondaryActionTextOverride = __('View applicable errata');
    break;
  case 'Unknown':
    emptyContentTitle = __('Unknown errata status');
    emptyContentBody = errataStatusLabel;
    break;
  default:
    emptyContentTitle = emptySearchTitle;
    emptyContentBody = emptySearchBody;
  }

  const errorSearchTitle = __('Problem searching errata');
  const columnHeaders = [
    __('Errata'),
    __('Type'),
    __('Severity'),
    __('Installable'),
    __('Synopsis'),
    __('Published date'),
  ];
  const COLUMNS_TO_SORT_PARAMS = {
    [columnHeaders[0]]: 'errata_id',
    [columnHeaders[1]]: 'type',
    [columnHeaders[2]]: 'severity',
    [columnHeaders[5]]: 'updated',
  };

  const {
    pfSortParams, apiSortParams,
    activeSortColumn, activeSortDirection,
  } = useTableSort({
    allColumns: columnHeaders,
    columnsToSortParams: COLUMNS_TO_SORT_PARAMS,
    initialSortColumnName: 'Errata',
  });

  const filtersQuery = () => {
    const query = [];
    if (errataTypeSelected !== ERRATA_TYPE) {
      query.push(`type=${TYPES_TO_PARAM[errataTypeSelected]}`);
    }
    if (errataSeveritySelected !== ERRATA_SEVERITY) {
      query.push(`severity=${SEVERITIES_TO_PARAM[errataSeveritySelected]}`);
    }
    return query.join(' and ');
  };

  const fetchItems = useCallback(
    (params) => {
      if (!hostId) return hostIdNotReady;
      const modifiedParams = { ...params };
      if (errataTypeSelected !== ERRATA_TYPE) {
        modifiedParams.type = TYPES_TO_PARAM[errataTypeSelected];
      }
      if (errataSeveritySelected !== ERRATA_SEVERITY) {
        modifiedParams.severity = SEVERITIES_TO_PARAM[errataSeveritySelected];
      }
      return getInstallableErrata(
        hostId,
        {
          include_applicable: toggleGroupState === APPLICABLE,
          ...apiSortParams,
          ...modifiedParams,
        },
      );
    },
    [hostId, toggleGroupState, APPLICABLE, ERRATA_SEVERITY, ERRATA_TYPE,
      errataTypeSelected, errataSeveritySelected, apiSortParams],
  );

  const response = useSelector(state => selectAPIResponse(state, HOST_ERRATA_KEY));
  const { results, ...metadata } = response;
  const { error: errorSearchBody } = metadata;
  const status = useSelector(state => selectHostErrataStatus(state));
  const errataSearchQuery = id => `errata_id = ${id}`;
  const {
    selectOne, isSelected, searchQuery, selectedCount, isSelectable,
    updateSearchQuery, selectNone, fetchBulkParams, ...selectAll
  } = useBulkSelect({
    results,
    metadata,
    idColumn: 'errata_id',
    filtersQuery: filtersQuery(),
    isSelectable: result => result.installable,
    initialSearchQuery: searchParam || '',
  });

  const installErrataAction = () => installErrata({
    hostname, search: fetchBulkParams(),
  });
  const {
    triggerJobStart: triggerBulkApply, lastCompletedJob: lastCompletedBulkApply,
    isPolling: isBulkApplyInProgress,
  } = useRexJobPolling(installErrataAction, getHostDetails({ hostname }));

  const installErratumAction = id => installErrata({
    hostname,
    search: errataSearchQuery(id),
  });

  const {
    triggerJobStart: triggerApply, lastCompletedJob: lastCompletedApply,
    isPolling: isApplyInProgress,
  } = useRexJobPolling(installErratumAction);

  const actionInProgress = (isApplyInProgress || isBulkApplyInProgress);
  const disabledReason = __('A remote execution job is in progress');

  const tdSelect = useCallback((errataId, rowIndex, rexJobInProgress) => ({
    isDisabled: rexJobInProgress || !isSelectable(errataId),
    isSelected: isSelected(errataId),
    onSelect: (event, selected) => selectOne(selected, errataId),
    rowIndex,
    variant: 'checkbox',
  }), [isSelectable, isSelected, selectOne]);

  // If the API results for total errata don't match hostDetails.contentFacet's
  // stored errata counts, this probably means the stored errata counts have been
  // updated and we should trigger a refresh of hostDetails.
  useDeepCompareEffect(() => {
    if (!metadata || !contentFacet) return;
    const resultCount = metadata?.total;
    // eslint-disable-next-line no-restricted-globals
    if (isNaN(resultCount)) return;
    const { search } = metadata;
    const isFiltering = !isEqual(activeFilters, defaultFilters);
    const errataTotal = contentFacet?.errataCounts?.total;
    const shouldTrigger = (errataTotal !== resultCount && !isFiltering && !search);
    if (shouldTrigger) {
      dispatch(getHostDetails({ hostname })); // this will update the errata overview chart
    }
  }, [activeFilters, defaultFilters, metadata,
    contentFacet.errataCounts?.total, contentFacet, dispatch, hostname]);

  if (!hostId) return <Skeleton />;

  const applyErratumViaRemoteExecution = id => triggerApply(id);

  const applyErrata = () => {
    triggerBulkApply();
    selectNone();
  };

  const bulkCustomizedRexUrl = () => errataInstallUrl({
    hostname, search: (selectedCount > 0) ? fetchBulkParams() : '',
  });

  const showActions = can(invokeRexJobs, userPermissions);

  const readOnlyBookmarks =
  cannot(createBookmarks, userPermissionsFromHostDetails({ hostDetails }));

  const dropdownKebabItems = [
    <DropdownItem
      aria-label="bulk_add"
      ouiaId="bulk_add"
      key="bulk_add"
      component="button"
      onClick={recalculateErrata}
    >
      {__('Refresh errata applicability')}
    </DropdownItem>,
  ];

  const dropdownItems = [
    <DropdownItem
      aria-label="apply_via_remote_execution"
      ouiaId="apply_via_remote_execution"
      key="apply_via_remote_execution"
      component="button"
      onClick={applyErrata}
      isDisabled={selectedCount === 0}
    >
      {__('Apply via remote execution')}
    </DropdownItem>,
    <DropdownItem
      aria-label="apply_via_customized_remote_execution"
      ouiaId="apply_via_customized_remote_execution"
      key="apply_via_customized_remote_execution"
      component="a"
      href={bulkCustomizedRexUrl()}
      isDisabled={selectedCount === 0}
    >
      {__('Apply via customized remote execution')}
    </DropdownItem>,
  ];

  const handleErrataTypeSelected = newType => setErrataTypeSelected((prevType) => {
    if (prevType === newType) {
      return ERRATA_TYPE;
    }
    return newType;
  });

  const handleErrataSeveritySelected = newSeverity => setErrataSeveritySelected((prevSeverity) => {
    if (prevSeverity === newSeverity) {
      return ERRATA_SEVERITY;
    }
    return newSeverity;
  });

  const actionButtons = showActions ? (
    <>
      <Split hasGutter>
        <SplitItem>
          <ActionList isIconList>
            <ActionListItem>
              <Dropdown
                aria-label="errata_dropdown"
                ouiaId="errata_dropdown"
                toggle={
                  <DropdownToggle
                    aria-label="expand_errata_toggle"
                    ouiaId="expand_errata_toggle"
                    splitButtonItems={[
                      <DropdownToggleAction key="action" aria-label="bulk_actions" onClick={applyErrata}>
                        {__('Apply')}
                      </DropdownToggleAction>,
                    ]}
                    splitButtonVariant="action"
                    toggleVariant="primary"
                    onToggle={onActionToggle}
                    isDisabled={selectedCount === 0}
                  />
              }
                isOpen={isActionOpen}
                dropdownItems={dropdownItems}
              />
            </ActionListItem>
            {showRecalculate &&
            <ActionListItem>
              <Dropdown
                ouiaId="bulk-actions-dropdown"
                toggle={<KebabToggle aria-label="bulk_actions_kebab" onToggle={toggleBulkAction} />}
                isOpen={isBulkActionOpen}
                isPlain
                dropdownItems={dropdownKebabItems}
              />
            </ActionListItem>
            }
          </ActionList>
        </SplitItem>
      </Split>
    </>
  ) : null;

  const hostIsNonLibrary = (
    (contentFacet?.contentViewDefault === false ||
      contentFacet.lifecycleEnvironmentLibrary === false) &&
    contentFacet.contentView.rolling === false
  );
  const toggleGroup = (
    <Split hasGutter>
      <SplitItem>
        <SelectableDropdown
          id="errata-type-dropdown"
          title={ERRATA_TYPE}
          showTitle={false}
          items={Object.values(ERRATA_TYPES)}
          selected={errataTypeSelected}
          setSelected={handleErrataTypeSelected}
          isDisabled={!results?.length}
        />
      </SplitItem>
      <SplitItem>
        <SelectableDropdown
          id="errata-severity-dropdown"
          title={ERRATA_SEVERITY}
          showTitle={false}
          items={Object.values(ERRATA_SEVERITIES)}
          selected={errataSeveritySelected}
          setSelected={handleErrataSeveritySelected}
          isDisabled={!results?.length}
        />
      </SplitItem>
      {hostIsNonLibrary &&
        <SplitItem>
          <ToggleGroup aria-label="Installable Errata">
            <ToggleGroupItem
              text={__('Applicable')}
              buttonId="applicableToggle"
              aria-label="Show applicable errata"
              isSelected={toggleGroupState === APPLICABLE}
              onChange={() => setToggleGroupState(APPLICABLE)}
            />
            <ToggleGroupItem
              text={__('Installable')}
              buttonId="installableToggle"
              aria-label="Show installable errata"
              isSelected={toggleGroupState === INSTALLABLE}
              onChange={() => setToggleGroupState(INSTALLABLE)}
            />
          </ToggleGroup>
          <Tooltip
            content={__('Applicable errata apply to at least one package installed on the host.')}
            position="top"
            enableFlip
            triggerRef={() => document.getElementById('applicableToggle')}
          />
          <Tooltip
            content={__('Installable errata are applicable errata that are available in the host\'s assigned content view environments.')}
            position="top"
            enableFlip
            triggerRef={() => document.getElementById('installableToggle')}
          />
        </SplitItem>
      }
    </Split>
  );

  return (
    <div>
      <div id="errata-tab">
        {hostIsImageMode({ hostDetails }) && <ImageModeHostAlert />}
        <TableWrapper
          {...{
            metadata,
            emptyContentTitle,
            emptyContentBody,
            emptySearchTitle,
            emptySearchBody,
            errorSearchTitle,
            errorSearchBody,
            status,
            activeFilters,
            defaultFilters,
            actionButtons,
            searchQuery,
            updateSearchQuery,
            selectedCount,
            selectNone,
            toggleGroup,
            resetFilters,
            secondaryActionTextOverride,
          }
          }
          showSecondaryActionButton={neededErrata || showRecalculate}
          happyEmptyContent={allUpToDate}
          ouiaId="host-errata-table"
          additionalListeners={[
            hostId, toggleGroupState, errataTypeSelected,
            errataSeveritySelected, activeSortColumn, activeSortDirection,
            lastCompletedApply, lastCompletedBulkApply, lastCompletedRecalculate]}
          fetchItems={fetchItems}
          bookmarkController="katello_errata"
          readOnlyBookmarks={readOnlyBookmarks}
          autocompleteEndpoint={`/api/v2/hosts/${hostId}/errata`}
          rowsCount={results?.length}
          variant={TableVariant.compact}
          {...selectAll}
          displaySelectAllCheckbox={showActions}
          requestKey={HOST_ERRATA_KEY}
          alwaysShowActionButtons={false}
          alwaysShowToggleGroup={hostIsNonLibrary && neededErrata}
        >
          <Thead>
            <Tr ouiaId="row-header">
              <Th key="expand-carat" aria-label="expand table header" />
              <Th key="select-all" aria-label="Select all table header" />
              <SortableColumnHeaders
                columnHeaders={columnHeaders}
                pfSortParams={pfSortParams}
                columnsToSortParams={COLUMNS_TO_SORT_PARAMS}
              />
              <Th key="action-menu" aria-label="action menu table header" />
            </Tr>
          </Thead>
          <>
            {results?.map((erratum, rowIndex) => {
              const {
                id,
                errata_id: errataId,
                created_at: createdAt,
                updated: publishedAt,
                title,
                installable: isInstallable,
              } = erratum;
              const isExpanded = erratumIsExpanded(id);
              let rowActions;
              if (isInstallable) {
                rowActions = [
                  {
                    title: __('Apply via remote execution'),
                    onClick: () => applyErratumViaRemoteExecution(errataId),
                    isDisabled: actionInProgress,
                  },
                  {
                    title: <a href={errataInstallUrl({ hostname, search: errataSearchQuery(errataId) })}>{__('Apply via customized remote execution')}</a>,
                  },
                ];
              } else {
                rowActions = [
                  {
                    title: <a href={urlBuilder(`errata/${id}`, '')}>{__('View details')}</a>, // Incremental update
                  },
                ];
              }

              return (
                <Tbody isExpanded={isExpanded} key={`${id}_${createdAt}`}>
                  <Tr ouiaId={`row-${rowIndex}`}>
                    <Td
                      expand={{
                        rowIndex,
                        isExpanded,
                        onToggle: (_event, _rInx, isOpen) => expandedErrata.onToggle(isOpen, id),
                      }}
                    />
                    {showActions ? (
                      <Td
                        select={tdSelect(errataId, rowIndex, actionInProgress)}
                        title={actionInProgress && disabledReason}
                      />
                    ) : null}
                    <Td>
                      <a href={urlBuilder(`errata/${id}`, '')}>{errataId}</a>
                    </Td>
                    <Td><ErrataType {...erratum} /></Td>
                    <Td><ErrataSeverity {...erratum} /></Td>
                    <Td>
                      {isInstallable ?
                        <span><CheckIcon /> {__('Yes')}</span> :
                        <span>
                          <Tooltip
                            content={
                              __("This erratum is not installable because it is not in this host's assigned content view environments.")
                            }
                          >

                            <TimesIcon />
                          </Tooltip>
                          {__('No')}
                        </span>
                      }
                    </Td>
                    <Td><TableText wrapModifier="truncate">{title}</TableText></Td>
                    <Td key={publishedAt}><IsoDate date={publishedAt} /></Td>
                    {showActions ? (
                      <Td
                        key={`rowActions-${id}`}
                        actions={{
                          items: rowActions,
                        }}
                      />
                    ) : null}
                  </Tr>
                  <Tr key="child_row" ouiaId="row-child" isExpanded={isExpanded}>
                    {isExpanded && (
                      <>
                        <Td colSpan={3}>
                          <ExpandableRowContent>
                            <ErratumExpansionContents erratum={erratum} />
                          </ExpandableRowContent>
                        </Td>
                        <Td colSpan={4}>
                          <ExpandableRowContent>
                            <ErratumExpansionDetail erratum={erratum} />
                          </ExpandableRowContent>
                        </Td>
                      </>
                    )}
                  </Tr>
                </Tbody>
              );
            })
            }
          </>
        </TableWrapper>
      </div>
    </div>
  );
};

export default ErrataTab;
