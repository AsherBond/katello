module Katello
  module Pulp3
    class Deb < PulpContentUnit
      include LazyAccessor
      CONTENT_TYPE = "deb".freeze
      PULPCORE_CONTENT_TYPE = "deb.package".freeze

      lazy_accessor :initializer => :backend_data

      def self.content_api
        PulpDebClient::ContentPackagesApi.new(Katello::Pulp3::Api::Apt.new(SmartProxy.pulp_primary!).api_client)
      end

      def self.content_api_create(opts = {})
        opts.delete(:relative_path) if opts.key?(:relative_path)
        self.content_api.create(opts)
      end

      def self.create_content(options)
        fail _("Artifact Id and relative path are needed to create content") unless options.dig(:file_name) && options.dig(:artifact)
        PulpDebClient::DebContent.new(relative_path: options[:file_name], artifact: options[:artifact])
      end

      def self.ids_for_repository(repo_id)
        repo = Katello::Pulp3::Repository::Apt.new(Katello::Repository.find(repo_id), SmartProxy.pulp_primary)
        repo_content_list = repo.content_list
        repo_content_list.map { |content| content.try(:pulp_href) }
      end

      def self.generate_model_row(unit)
        unit = unit.try(:with_indifferent_access)
        return {
          pulp_id: unit[unit_identifier],
          checksum: unit[:sha256],
          filename: unit[:relative_path],
          name: unit[:package],
          version: unit[:version],
          description: unit[:description]&.truncate(255),
          architecture: unit[:architecture],
          section: unit[:section],
          maintainer: unit[:maintainer],
          homepage: unit[:homepage],
          installed_size: unit[:installed_size],
        }
      end

      def depends
        Util::Deb.parse_dependencies(backend_data['depends'])
      end

      def pre_depends
        Util::Deb.parse_dependencies(backend_data['pre_depends'])
      end

      def recommends
        Util::Deb.parse_dependencies(backend_data['recommends'])
      end

      def suggests
        Util::Deb.parse_dependencies(backend_data['suggests'])
      end

      def enhances
        Util::Deb.parse_dependencies(backend_data['enhances'])
      end

      def breaks
        Util::Deb.parse_dependencies(backend_data['breaks'])
      end

      def conflicts
        Util::Deb.parse_dependencies(backend_data['conflicts'])
      end
    end
  end
end
