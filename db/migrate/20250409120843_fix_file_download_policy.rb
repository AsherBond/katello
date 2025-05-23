class FixFileDownloadPolicy < ActiveRecord::Migration[6.1]
  def up
    Katello::RootRepository.where(content_type: "file")
                           .where(download_policy: [nil, ""])
                           .update_all(:download_policy => "immediate")
  end

  def down
    fail ActiveRecord::IrreversibleMigration
  end
end
