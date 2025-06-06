object @resource

extends 'katello/api/v2/common/identifier'

attributes :version, :major, :minor
attributes :composite_content_view_ids
attributes :published_in_composite_content_view_ids
attributes :content_view_id
attributes :default
attributes :description

node do |version|
  version.content_counts_map
end

node :component_view_count do |version|
  version&.components&.count
end

node do |version|
  version.repository_type_counts_map
end
node :errata_counts do |version|
  partial('katello/api/v2/errata/counts', :object => Katello::RelationPresenter.new(version.errata))
end

child :content_view => :content_view do
  attributes :id, :name, :label, :generated_for
end

child :composite_content_views => :composite_content_views do
  attributes :id, :name, :label
end

child :composites => :composite_content_view_versions do
  attributes :id, :content_view_id, :version
end

child :published_in_composite_content_views => :published_in_composite_content_views do
  attributes :id, :name, :label
end

node :permissions do |cvv|
  {
    :deletable => cvv.removable?,
  }
end

child :content_view_environments => :content_view_environments do
  attributes :label, :environment_id, :environment_name
end

extends 'katello/api/v2/common/timestamps'

version = @object || @resource
child :sorted_organization_readable_environments => :environments do
  attributes :id, :name, :label

  node :publish_date do |env|
    time_ago_in_words(version.env_promote_date(env))
  end

  node :permissions do |env|
    {
      :readable => env.readable?,
      :promotable_or_removable => env.promotable_or_removable?,
      :all_hosts_editable => version.all_hosts_editable?(env),
      :all_keys_editable => Katello::ActivationKey.all_editable?(version.content_view_id, env.id),
    }
  end

  node :host_count do |env|
    ::Host.authorized('view_hosts').in_content_view_environment(:content_view => version.content_view, :lifecycle_environment => env).count
  end

  node :multi_env_host_count do |env|
    hosts = ::Host.authorized('view_hosts')
      .in_content_view_environments(content_views: [version.content_view], lifecycle_environments: [env])
    hosts.count { |host| host.content_facet.multi_content_view_environment? }
  end

  node :activation_key_count do |env|
    Katello::ActivationKey.with_content_views(version.content_view).with_environments(env).count
  end

  node :multi_env_ak_count do |env|
    keys = Katello::ActivationKey.with_content_views(version.content_view)
      .with_environments(env)
    keys.count { |key| key.multi_content_view_environment? }
  end
end

child :archived_repos => :repositories do
  attributes :id, :name, :label, :content_type, :library_instance_id, :mirroring_policy
end

child :last_event => :last_event do
  extends 'katello/api/v2/content_view_histories/show'
end

child :active_history => :active_history do
  extends 'katello/api/v2/content_view_histories/show'
end

node :filters_applied do |cv_version|
  cv_version.filters_applied?
end

if ::Foreman::Cast.to_bool(params.fetch(:include_applied_filters, false))
  node :applied_filters do |cv_version|
    cv_version.applied_filters
  end
end
