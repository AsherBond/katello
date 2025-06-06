import React, { useState, useEffect, useCallback } from 'react';
import useDeepCompareEffect from 'use-deep-compare-effect';
import PropTypes from 'prop-types';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import { omit } from 'lodash';
import { TableVariant } from '@patternfly/react-table';
import {
  Tabs,
  Tab,
  TabTitleText,
  Split,
  SplitItem,
  Button,
} from '@patternfly/react-core';
import {
  Dropdown,
  DropdownItem,
  KebabToggle,
} from '@patternfly/react-core/deprecated';
import { STATUS } from 'foremanReact/constants';
import { translate as __ } from 'foremanReact/common/I18n';
import onSelect from '../../../../components/Table/helpers';
import TableWrapper from '../../../../components/Table/TableWrapper';
import {
  selectCVFilterDetails,
  selectCVFilterRules,
  selectCVFilterRulesStatus,
} from '../ContentViewDetailSelectors';
import { deleteContentViewFilterRules, getCVFilterRules, removeCVFilterRule } from '../ContentViewDetailActions';
import AddEditContainerTagRuleModal from './Rules/ContainerTag/AddEditContainerTagRuleModal';
import AffectedRepositoryTable from './AffectedRepositories/AffectedRepositoryTable';
import { hasPermission } from '../../helpers';
import { emptyContentTitle,
  emptyContentBody,
  emptySearchTitle,
  emptySearchBody } from './FilterRuleConstants';
import { CONTENT_VIEW_NEEDS_PUBLISH } from '../../ContentViewsConstants';

const CVContainerImageFilterContent = ({
  cvId, filterId, showAffectedRepos, setShowAffectedRepos, details,
}) => {
  const dispatch = useDispatch();
  const response = useSelector(state => selectCVFilterRules(state, filterId), shallowEqual);
  const status = useSelector(state => selectCVFilterRulesStatus(state, filterId), shallowEqual);
  const filterDetails = useSelector(state =>
    selectCVFilterDetails(state, cvId, filterId), shallowEqual);
  const { repositories = [] } = filterDetails;
  const [rows, setRows] = useState([]);
  const [searchQuery, updateSearchQuery] = useState('');
  const [activeTabKey, setActiveTabKey] = useState(0);
  const [selectedFilterRuleData, setSelectedFilterRuleData] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const loading = status === STATUS.PENDING;
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const deselectAll = () => setRows(rows.map(row => ({ ...row, selected: false })));
  const toggleBulkAction = () => setBulkActionOpen(prevState => !prevState);
  const hasSelected = rows.some(({ selected }) => selected);
  const metadata = omit(response, ['results']);
  const { permissions } = details;
  const showPrimaryAction = true;
  const primaryActionButton =
    (
      <Button
        ouiaId="add-content-view-container-image-filter-button"
        onClick={() => setModalOpen(true)}
        variant="primary"
        aria-label="add_filter_rule_empty_state"
      > {__('Add filter rule')}
      </Button>);
  const onClose = () => {
    setModalOpen(false);
    setSelectedFilterRuleData(undefined);
  };

  const columnHeaders = [
    __('Tag name'),
  ];

  const repositoryIds = details.repository_ids;

  const bulkRemove = () => {
    setBulkActionOpen(false);
    const tagFilterIds =
      rows.filter(row => row.selected).map(selected => selected.id);
    dispatch(deleteContentViewFilterRules(filterId, tagFilterIds, () => {
      dispatch(getCVFilterRules(filterId));
      dispatch({ type: CONTENT_VIEW_NEEDS_PUBLISH });
    }));
    deselectAll();
  };

  useEffect(() => {
    if (!repositories.length && showAffectedRepos) {
      setActiveTabKey(1);
    } else {
      setActiveTabKey(0);
    }
  }, [showAffectedRepos, repositories.length]);

  useDeepCompareEffect(() => {
    const { results } = response;
    if (!loading && results) {
      setRows([...results.map((containerRule) => {
        const { name, id } = containerRule;
        return ({
          cells: [{ title: name }],
          name,
          id,
        });
      })]);
    }
  }, [response, loading]);

  const actionResolver = () => [
    {
      title: __('Remove'),
      onClick: (_event, _rowId, { id }) => {
        dispatch(removeCVFilterRule(filterId, id, () => {
          dispatch(getCVFilterRules(filterId));
          dispatch({ type: CONTENT_VIEW_NEEDS_PUBLISH });
        }));
      },
    },
    {
      title: __('Edit'),
      onClick: (_event, _rowId, { name, id }) => {
        setSelectedFilterRuleData({ name, id });
        setModalOpen(true);
      },
    },
  ];

  return (
    <Tabs
      className="margin-0-24"
      activeKey={activeTabKey}
      ouiaId="cv-container-image-filter-tabs"
      onSelect={(_event, eventKey) => setActiveTabKey(eventKey)}
    >
      <Tab
        ouiaId="cv-container-image-filter-tags-tab"
        eventKey={0}
        title={<TabTitleText>{__('Tags')}</TabTitleText>}
      >
        <div className="margin-24-0">
          <TableWrapper
            {...{
              rows,
              metadata,
              emptyContentTitle,
              emptyContentBody,
              emptySearchTitle,
              emptySearchBody,
              searchQuery,
              updateSearchQuery,
              status,
              showPrimaryAction,
              primaryActionButton,
            }}
            ouiaId="content-view-container-image-filter"
            actionResolver={hasPermission(permissions, 'edit_content_views') ? actionResolver : null}
            onSelect={hasPermission(permissions, 'edit_content_views') ? onSelect(rows, setRows) : null}
            cells={columnHeaders}
            variant={TableVariant.compact}
            autocompleteEndpoint={`/katello/api/v2/content_view_filters/${filterId}/rules`}
            bookmarkController="katello_content_view_docker_filter_rules"
            fetchItems={useCallback(params => getCVFilterRules(filterId, params), [filterId])}
            actionButtons={hasPermission(permissions, 'edit_content_views') &&
              <>
                {status === STATUS.RESOLVED && rows.length !== 0 &&
                  <Split hasGutter>
                    <SplitItem>
                      <Button
                        ouiaId="add-content-view-container-image-filter-button"
                        onClick={() => setModalOpen(true)}
                        variant="primary"
                        aria-label="add_filter_rule"
                      >
                        {__('Add filter rule')}
                      </Button>
                    </SplitItem>
                    <SplitItem>
                      <Dropdown
                        toggle={<KebabToggle aria-label="bulk_actions" onToggle={toggleBulkAction} />}
                        isOpen={bulkActionOpen}
                        ouiaId="cv-container-image-bulk-actions"
                        isPlain
                        dropdownItems={[
                          <DropdownItem ouiaId="cv-container-image-bulk-remove" aria-label="bulk_remove" key="bulk_remove" isDisabled={!hasSelected} component="button" onClick={bulkRemove}>
                            {__('Remove')}
                          </DropdownItem>]
                        }
                      />
                    </SplitItem>
                  </Split>}
                {modalOpen &&
                  <AddEditContainerTagRuleModal
                    {...{
                      filterId, selectedFilterRuleData, onClose, repositoryIds,
                    }}
                  />
                }
              </>
            }
          />
        </div>
      </Tab>
      {(repositories.length || showAffectedRepos) &&
        <Tab
          ouiaId="cv-container-image-affected-repos-tab"
          eventKey={1}
          title={<TabTitleText>{__('Affected repositories')}</TabTitleText>}
        >
          <div className="margin-24-0">
            <AffectedRepositoryTable cvId={cvId} filterId={filterId} repoType="docker" setShowAffectedRepos={setShowAffectedRepos} details={details} />
          </div>
        </Tab>
      }
    </Tabs>
  );
};

CVContainerImageFilterContent.propTypes = {
  cvId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  filterId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  showAffectedRepos: PropTypes.bool,
  setShowAffectedRepos: PropTypes.func,
  details: PropTypes.shape({
    repository_ids: PropTypes.arrayOf(PropTypes.number),
    permissions: PropTypes.shape({}),
  }).isRequired,
};

CVContainerImageFilterContent.defaultProps = {
  cvId: '',
  filterId: '',
  showAffectedRepos: false,
  setShowAffectedRepos: () => { },
};
export default CVContainerImageFilterContent;
