# encoding: utf-8
#
# Copyright 2014 Red Hat, Inc.
#
# This software is licensed to you under the GNU General Public
# License as published by the Free Software Foundation; either version
# 2 of the License (GPLv2) or (at your option) any later version.
# There is NO WARRANTY for this software, express or implied,
# including the implied warranties of MERCHANTABILITY,
# NON-INFRINGEMENT, or FITNESS FOR A PARTICULAR PURPOSE. You should
# have received a copy of GPLv2 along with this software; if not, see
# http://www.gnu.org/licenses/old-licenses/gpl-2.0.txt.

require 'katello_test_helper'

module Katello
class OrganizationTestBase < ActiveSupport::TestCase

  def self.before_suite
    services  = ['Candlepin', 'Pulp', 'ElasticSearch', 'Foreman']
    models    = ['Organization', 'KTEnvironment', 'ContentView', 'ContentViewVersion',
                 'ContentViewEnvironment']
    disable_glue_layers(services, models, true)
  end

  def setup
  end

end

class OrganizationTestCreate < OrganizationTestBase

  def test_create_validate_view
    User.current = User.find(users(:admin))
    org = Organization.create!(:name=>"TestOrg", :label=>'test_org')
    refute_nil org.library
    refute_nil org.default_content_view
    refute_nil org.library.default_content_view_version
    refute_empty org.default_content_view.content_view_environments
  end

  def test_org_being_deleted
    Organization.any_instance.stubs(:being_deleted?).returns(true)
    User.current = User.find(users(:admin))
    org = Organization.create!(:name=>"TestOrg", :label=>'test_org')
    org.content_view_environments.first.destroy!
    org.reload.library.destroy!
    id = org.id
    org.destroy!
    assert_nil Organization.find_by_id(id)
  end

end
end
