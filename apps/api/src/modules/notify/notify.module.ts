import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { QueueNameEnum } from '@job-agent/shared';

import { VacanciesModule } from '../vacancies/vacancies.module.js';
import { NotifyConsumer } from './consumers/notify.consumer.js';
import { NotificationRepository } from './repositories/notification.repository.js';
import { NotificationService } from './services/notification.service.js';
import { NotifyScheduler } from './services/notify.scheduler.js';
import { TelegramService } from './services/telegram.service.js';
import { VacancyActionService } from './services/vacancy-action.service.js';

/**
 * Telegram: the cards, the notices, the buttons, the sweep of the cards not sent yet
 */
@Module({
  imports: [VacanciesModule, BullModule.registerQueue({ name: QueueNameEnum.NOTIFY })],
  providers: [NotificationRepository, VacancyActionService, TelegramService, NotificationService, NotifyConsumer, NotifyScheduler]
})
export class NotifyModule {}
