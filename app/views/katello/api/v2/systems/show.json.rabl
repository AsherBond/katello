object @resource

@resource ||= @object

node(:id) { |resource| resource.uuid }
attributes :uuid, :name, :description
attributes :location
attributes :content_view, :content_view_id
attributes :distribution
attributes :katello_agent_installed? => :katello_agent_installed

child :products => :products do |product|
  attributes :id, :name
end
attributes :content_overrides

child :foreman_host => :host do
  attributes :id, :name
  attributes :host_status => :status
  attributes :last_report

  child :environment => :puppet_environment do
    attributes :id, :name
  end
  child :operatingsystem do
    attributes :id, :name, :description
  end
  child :model do
    attributes :id, :name
  end
  child :hostgroup do
    attributes :id, :name
  end
end

child :host_collections => :hostCollections do
  attributes :id, :name, :description, :max_content_hosts, :total_content_hosts
end

child :custom_info => :customInfo do
  attributes :id, :keyname, :value
end

child :environment => :environment do
  extends 'katello/api/v2/environments/show'
end

child :activation_keys => :activation_keys do
  attributes :id, :name, :description
end

# Candlepin attributes
attributes :entitlementStatus
attributes :autoheal
attributes :href, :release, :ipv4_address
attributes :checkin_time, :created
attributes :installedProducts

attributes :serviceLevel => :service_level

node :release_ver do |sys|
  sys.releaseVer.is_a?(Hash) ? sys.releaseVer[:releaseVer] : sys.releaseVer
end

# Requires another API call to fetch from Candlepin
if params[:fields] == "full"
  attributes :system_type => :type
  attributes :compliance
  attributes :facts

  if @resource.respond_to?(:virtual_guest) || @resource.respond_to?(:virtual_host)
    if @resource.virtual_guest
      node :virtual_host do |system|
        system.virtual_host.attributes if system.virtual_host
      end
    else
      node :virtual_guests do |system|
        system.virtual_guests.map(&:attributes)
      end
    end
  end
end

node :permissions do |activation_key|
  {
    :editable => true
  }
end
