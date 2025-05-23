object @environment => :environment

extends 'katello/api/v2/common/identifier'
extends 'katello/api/v2/common/org_reference'

attributes :library
attributes :registry_name_pattern, :registry_unauthenticated_pull

if @content_source.present?
  node :content_source do |env|
    {
      :name => @content_source.name,
      :id => @content_source_id,
      :environment_is_associated => env.content_source_associated?(@content_source),
    }
  end
end

node :prior do |env|
  if env.prior
    {name: env.prior.name, :id => env.prior.id}
  end
end

node :successor do |env|
  if !env.library && env.successor
    {name: env.successor.name, :id => env.successor.id}
  end
end

node :counts do |env|
  counts = {
    :content_hosts => env.hosts.authorized("view_hosts").count,
    :content_views => env.content_views.non_default.count,
  }
  if env.library?
    repos = env.repositories.in_default_view
    counts[:packages] = Katello::Rpm.total_for_repositories(repos)
    counts[:module_streams] = Katello::ModuleStream.in_repositories(repos).count
    counts[:errata] = partial('katello/api/v2/errata/counts', :object => Katello::RelationPresenter.new(Katello::Erratum.in_repositories(repos)))
    counts[:yum_repositories] = repos.yum_type.count
    counts[:docker_repositories] = repos.docker_type.count
    counts[:ostree_repositories] = repos.ostree_type.count
    counts[:products] = env.organization.products.enabled.count
    counts[:debs] = Katello::Deb.total_for_repositories(repos)
    counts[:deb_repositories] = repos.deb_type.count
  end
  counts
end

node :permissions do |env|
  {
    :create_lifecycle_environments => env.creatable?,
    :view_lifecycle_environments => env.readable?,
    :edit_lifecycle_environments => env.editable?,
    :destroy_lifecycle_environments => env.deletable?,
    :promote_or_remove_content_views_to_environments => env.promotable_or_removable?,
  }
end

node :content_views do |env|
  env.content_views.non_default.map do |cv|
    {
      :name => cv.name,
      :id => cv.id,
    }
  end
end

node :capsules do |env|
  env.capsules.map do |capsule|
    {
      :id => capsule.id,
      :name => capsule.name,
      :lifecycle_environments => capsule.capsule_lifecycle_environments.map do |cle|
        {
          :id => cle.lifecycle_environment.id,
        }
      end,
    }
  end
end

extends 'katello/api/v2/common/timestamps'
