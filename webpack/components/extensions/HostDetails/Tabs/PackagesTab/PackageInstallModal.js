import React, { useState } from 'react';
import {
  Modal,
  Button,
} from '@patternfly/react-core';
import {
  Dropdown,
  DropdownItem,
  DropdownToggle,
  DropdownDirection,
  DropdownToggleAction,
} from '@patternfly/react-core/deprecated';
import { CaretDownIcon, CaretUpIcon } from '@patternfly/react-icons';
import { useSelector } from 'react-redux';
import { FormattedMessage } from 'react-intl';
import { Thead, Th, Tbody, Tr, Td, TableVariant } from '@patternfly/react-table';
import { noop } from 'foremanReact/common/helpers';
import { translate as __ } from 'foremanReact/common/I18n';
import { urlBuilder } from 'foremanReact/common/urlHelpers';
import { selectAPIResponse } from 'foremanReact/redux/API/APISelectors';
import { useBulkSelect } from 'foremanReact/components/PF4/TableIndexPage/Table/TableHooks';
import PropTypes from 'prop-types';
import TableWrapper from '../../../../Table/TableWrapper';
import { HOST_YUM_INSTALLABLE_PACKAGES_KEY } from './YumInstallablePackagesConstants';
import { selectHostYumInstallablePackagesStatus } from './YumInstallablePackagesSelectors';
import { getHostYumInstallablePackages } from './YumInstallablePackagesActions';
import './PackageInstallModal.scss';
import { katelloPackageInstallBySearchUrl, katelloPackageInstallUrl } from '../customizedRexUrlHelpers';
import hostIdNotReady from '../../HostDetailsActions';

const InstallDropdown = ({
  isDisabled, installViaRex,
  bulkCustomizedRexUrl,
}) => {
  const [isActionOpen, setIsActionOpen] = useState(false);
  const onActionSelect = () => {
    setIsActionOpen(false);
  };
  const onActionToggle = () => {
    setIsActionOpen(prev => !prev);
  };

  const dropdownItems = [
    <DropdownItem key="install-rex" ouiaId="install-rex" component="button" onClick={installViaRex}>
      {__('Install via remote execution')}
    </DropdownItem>,
    <DropdownItem
      key="install-customized-rex"
      ouiaId="install-customized-rex"
      component="a"
      href={bulkCustomizedRexUrl}
      onClick={onActionSelect}
    >
      {__('Install via customized remote execution')}
    </DropdownItem>,
  ];

  return (
    <Dropdown
      ouiaId="action-dropdown"
      direction={DropdownDirection.up}
      onSelect={onActionSelect}
      toggle={
        <DropdownToggle
          ouiaId="install-action-toggle"
          isDisabled={isDisabled}
          splitButtonItems={[
            <DropdownToggleAction key="install" onClick={installViaRex}>
              Install
            </DropdownToggleAction>,
          ]}
          splitButtonVariant="action"
          toggleVariant="primary"
          toggleIndicator={isActionOpen ? CaretUpIcon : CaretDownIcon}
          onToggle={onActionToggle}
        />
      }
      isOpen={isActionOpen}
      dropdownItems={dropdownItems}
    />
  );
};

InstallDropdown.propTypes = {
  isDisabled: PropTypes.bool,
  installViaRex: PropTypes.func,
  bulkCustomizedRexUrl: PropTypes.string,
};

InstallDropdown.defaultProps = {
  isDisabled: false,
  installViaRex: noop,
  bulkCustomizedRexUrl: '',
};

const PackageInstallModal = ({
  isOpen, closeModal, hostId, hostName, triggerPackageInstall,
}) => {
  const emptyContentTitle = __('No packages available to install');
  const emptyContentBody = __('No packages available to install on this host. Please check the host\'s assigned content view environments.');
  const emptySearchTitle = __('No matching packages found');
  const emptySearchBody = __('Try changing your search settings.');
  const columnHeaders = ['', __('Package'), __('Version')];
  const response =
    useSelector(state => selectAPIResponse(state, HOST_YUM_INSTALLABLE_PACKAGES_KEY));
  const status = useSelector(state => selectHostYumInstallablePackagesStatus(state));
  const { results, ...metadata } = response;
  const [suppressFirstFetch, setSuppressFirstFetch] = useState(false);

  const {
    searchQuery,
    updateSearchQuery,
    isSelected,
    selectOne,
    selectNone,
    fetchBulkParams,
    isSelectable,
    selectedCount,
    selectedResults,
    ...selectAll
  } = useBulkSelect({ results, metadata });

  const fetchItems = (params) => {
    if (!hostId) return hostIdNotReady;

    if (results?.length > 0 && suppressFirstFetch) {
      // If the modal has already been opened, no need to re-fetch the data that's already present
      setSuppressFirstFetch(false);
      return { type: 'HOST_APPLICABLE_PACKAGES_NOOP' };
    }
    return getHostYumInstallablePackages(hostId, params);
  };

  const selectedPackageNames = () => selectedResults.map(({ name }) => name);

  const installViaRex = () => {
    triggerPackageInstall(fetchBulkParams(), selectedPackageNames().join(', '));
    selectNone();
    closeModal();
  };

  const handleModalClose = () => {
    setSuppressFirstFetch(true);
    closeModal();
  };

  const bulkCustomizedRexUrl = selectedCount ?
    katelloPackageInstallBySearchUrl({ hostname: hostName, search: fetchBulkParams() }) :
    '#';
  const simpleBulkCustomizedRexUrl
    = katelloPackageInstallUrl({ hostname: hostName, packages: selectedPackageNames() });
  const enableSimpleRexUrl = !!selectedResults.length;

  const modalActions = ([
    <InstallDropdown
      key="install"
      isDisabled={!selectedCount}
      installViaRex={installViaRex}
      bulkCustomizedRexUrl={enableSimpleRexUrl ? simpleBulkCustomizedRexUrl : bulkCustomizedRexUrl}
    />,
    <Button key="cancel" ouiaId="cancel-button" variant="link" onClick={handleModalClose}>
      Cancel
    </Button>,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={__('Install packages')}
      width="50%"
      actions={modalActions}
      id="package-install-modal"
      ouiaId="package-install-modal"
    >
      <FormattedMessage
        className="pkg-install-modal-blurb"
        id="pkg-install-modal-blurb"
        defaultMessage={__('Select packages to install to the host {hostName}.')}
        values={{
          hostName: <strong>{hostName}</strong>,
        }}
      />
      <TableWrapper
        {...{
          metadata,
          emptyContentTitle,
          emptyContentBody,
          emptySearchTitle,
          emptySearchBody,
          status,
          searchQuery,
          updateSearchQuery,
          selectedCount,
          selectNone,
        }
        }
        ouiaId="host-package-install-table"
        additionalListeners={[hostId]}
        fetchItems={fetchItems}
        searchPlaceholderText={__('Search available packages')}
        autocompleteEndpoint={`/api/v2/hosts/${hostId}/packages`}
        variant={TableVariant.compact}
        {...selectAll}
        displaySelectAllCheckbox
      >
        <Thead>
          <Tr ouiaId="row-header">
            {columnHeaders.map(col =>
              <Th key={col}>{col}</Th>)}
            <Th aria-label="action menu header" />
          </Tr>
        </Thead>
        <Tbody>
          {results?.map((pkg, rowIndex) => {
            const {
              id,
              name: packageName,
              rpm_id: rpmId,
              version,
            } = pkg;
            return (
              <Tr key={id} ouiaId={`row-${id}`}>
                <Td
                  select={{
                    isDisabled: false,
                    isSelected: isSelected(id),
                    onSelect: (_event, selected) => selectOne(selected, id, pkg),
                    rowIndex,
                    variant: 'checkbox',
                  }}
                />
                <Td>
                  {rpmId
                    ? <a href={urlBuilder(`packages/${rpmId}`, '')}>{packageName}</a>
                    : packageName
                  }
                </Td>
                <Td>
                  {version}
                </Td>
              </Tr>
            );
          })
          }
        </Tbody>
      </TableWrapper>
    </Modal>
  );
};

PackageInstallModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  closeModal: PropTypes.func.isRequired,
  hostId: PropTypes.number.isRequired,
  hostName: PropTypes.string.isRequired,
  triggerPackageInstall: PropTypes.func.isRequired,
};

export default PackageInstallModal;
