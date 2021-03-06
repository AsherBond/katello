/**
 * Copyright 2014 Red Hat, Inc.
 *
 * This software is licensed to you under the GNU General Public
 * License as published by the Free Software Foundation; either version
 * 2 of the License (GPLv2) or (at your option) any later version.
 * There is NO WARRANTY for this software, express or implied,
 * including the implied warranties of MERCHANTABILITY,
 * NON-INFRINGEMENT, or FITNESS FOR A PARTICULAR PURPOSE. You should
 * have received a copy of GPLv2 along with this software; if not, see
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.txt.
 **/

/**
 * @ngdoc service
 * @name  Bastion.providers.factory:Package
 *
 * @requires BastionResource
 *
 * @description
 *   Provides a BastionResource for product or list of providers.
 */
angular.module('Bastion.packages').factory('Package',
    ['BastionResource', 'CurrentOrganization', function (BastionResource) {

        return BastionResource('/api/v2/packages/:id',
            {'id': '@id'},
            {
                autocomplete: {
                    method: 'GET',
                    url: '/packages/auto_complete',
                    transformResponse: function (data) {
                        data = angular.fromJson(data);
                        return {results: data};
                    }
                }
            });

    }]
);
