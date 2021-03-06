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
describe Api::V1::RootController do
  before (:each) do
    setup_controller_defaults_api
    @request.env["HTTP_ACCEPT"] = "application/json"
    @packages                   = { "rel" => "packages", "href" => "/api/packages/" }
    @systems                    = { "rel" => "systems", "href" => "/api/systems/" }
    @tasks                      = { "rel" => "tasks", "href" => "/api/tasks/" }
    @gpg_keys                   = { "rel" => "gpg_keys", "href" => "/api/gpg_keys/" }
  end

  def resource_list
    get :resource_list
  end

  def json(response)
    JSON.parse(response.body)
  end

  context "in headpin mode" do
    before (:each) do
      Katello.config.stubs(:katello?).returns(false)
    end
    it "should not show katello apis" do
      resource_list
      json(response).must_include @systems
      json(response).wont_include(@packages)
      json(response).wont_include(@tasks)
      json(response).wont_include(@gpg_keys)
    end
  end

  context "in katello mode" do
    before (:each) do
      Katello.config.stubs(:katello?).returns(true)
    end
    it "should show katello apis (katello)" do #TODO headpin
      resource_list
      json(response).must_include(@systems)
      json(response).must_include(@packages)
    end
  end

end
end