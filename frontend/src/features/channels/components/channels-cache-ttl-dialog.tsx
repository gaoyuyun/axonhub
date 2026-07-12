'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateChannel } from '../data/channels';
import { Channel } from '../data/schema';
import { mergeChannelSettingsForUpdate } from '../utils/merge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow: Channel;
}

const cacheTTLFormSchema = z.object({
  cacheTTL: z.string().optional().nullable(),
});

type CacheTTLFormValues = z.infer<typeof cacheTTLFormSchema>;

const NOT_CONFIGURED_VALUE = '__not_configured__';

export function ChannelsCacheTTLDialog({ open, onOpenChange, currentRow }: Props) {
  const { t } = useTranslation();
  const updateChannel = useUpdateChannel();
  const form = useForm<CacheTTLFormValues>({
    resolver: zodResolver(cacheTTLFormSchema),
    defaultValues: { cacheTTL: currentRow.settings?.cacheTTL ?? '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({ cacheTTL: currentRow.settings?.cacheTTL ?? '' });
    }
  }, [open, currentRow, form]);

  const onSubmit = async (values: CacheTTLFormValues) => {
    try {
      await updateChannel.mutateAsync({
        id: currentRow.id,
        input: {
          settings: mergeChannelSettingsForUpdate(currentRow.settings, {
            cacheTTL: values.cacheTTL || null,
          }),
        },
      });
      toast.success(t('channels.messages.updateSuccess'));
      onOpenChange(false);
    } catch (_error) {
      toast.error(t('common.errors.internalServerError'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state) form.reset();
        onOpenChange(state);
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-left'>
          <DialogTitle>{t('channels.dialogs.cacheTTL.title')}</DialogTitle>
          <DialogDescription>{t('channels.dialogs.cacheTTL.description', { name: currentRow.name })}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className='space-y-4' onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name='cacheTTL'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('channels.dialogs.cacheTTL.fields.cacheTTL.label')}</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value || NOT_CONFIGURED_VALUE}
                      onValueChange={(value) => field.onChange(value === NOT_CONFIGURED_VALUE ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOT_CONFIGURED_VALUE}>{t('channels.dialogs.cacheTTL.fields.cacheTTL.options.default')}</SelectItem>
                        <SelectItem value='5m'>{t('channels.dialogs.cacheTTL.fields.cacheTTL.options.5m')}</SelectItem>
                        <SelectItem value='1h'>{t('channels.dialogs.cacheTTL.fields.cacheTTL.options.1h')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>{t('channels.dialogs.cacheTTL.fields.cacheTTL.description')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                {t('common.buttons.cancel')}
              </Button>
              <Button type='submit' disabled={updateChannel.isPending}>
                {updateChannel.isPending ? t('common.buttons.saving') : t('common.buttons.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
