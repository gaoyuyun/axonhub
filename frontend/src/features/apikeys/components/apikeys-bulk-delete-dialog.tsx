'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useApiKeysContext } from '../context/apikeys-context';
import { useBulkDeleteApiKeys } from '../data/apikeys';

export function ApiKeysBulkDeleteDialog() {
  const { t } = useTranslation();
  const { isDialogOpen, closeDialog, selectedApiKeys, resetRowSelection, setSelectedApiKeys } = useApiKeysContext();
  const bulkDeleteApiKeys = useBulkDeleteApiKeys();

  if (!selectedApiKeys || selectedApiKeys.length === 0) return null;

  const handleBulkDelete = async () => {
    try {
      const ids = selectedApiKeys.map((apiKey) => apiKey.id);
      await bulkDeleteApiKeys.mutateAsync(ids);
      resetRowSelection();
      setSelectedApiKeys([]);
      closeDialog();
    } catch (_error) {
      // Error will be handled by the mutation's error state
    }
  };

  return (
    <ConfirmDialog
      open={isDialogOpen.bulkDelete}
      onOpenChange={() => closeDialog('bulkDelete')}
      handleConfirm={handleBulkDelete}
      disabled={bulkDeleteApiKeys.isPending}
      title={
        <span className='text-destructive'>
          <IconAlertTriangle className='stroke-destructive mr-1 inline-block' size={18} />
          {t('apikeys.dialogs.bulkDelete.title')}
        </span>
      }
      desc={t('apikeys.dialogs.bulkDelete.description', { count: selectedApiKeys.length })}
      confirmText={t('common.buttons.delete')}
      cancelBtnText={t('common.buttons.cancel')}
    />
  );
}
