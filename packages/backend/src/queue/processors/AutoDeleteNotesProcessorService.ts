/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { UserProfilesRepository, NotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { IdService } from '@/core/IdService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class AutoDeleteNotesProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
		@Inject(DI.userNotePiningsRepository)
		private userNotePiningsRepository: UserNotePiningsRepository,

		private idService: IdService,
		private noteDeleteService: NoteDeleteService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('auto-delete-notes');
	}

	@bindThis
	public async process(): Promise<void> {
		this.logger.info('Auto deleting old notes...');

		const userProfiles = await this.userProfilesRepository.createQueryBuilder('user_profile')
			.innerJoinAndSelect('user_profile.user', 'user')
			.where('user.host IS NULL')
			.andWhere('user_profile.autoDeleteNotes')
			.getMany();

		for (const userProfile of userProfiles) {
			const user = userProfile.user;
			this.logger.debug(`Deleting old notes of user @${user.username} (id ${user.id})`);
			const untilTime = Date.now() - (userProfile.autoDeleteNotesMinutes * 1000 * 60);
			const untilId = this.idService.gen(untilTime);

			const pins = await this.userNotePiningsRepository.createQueryBuilder('user_note_pining')
				.where('"userId" = :userId', { userId: user.id })
				.getMany();

			const pinnedNoteIds = pins.map((p) => p.noteId);

			const notes = await this.notesRepository.createQueryBuilder('note')
				.where('note."userId" = :userId', { userId: user.id })
				.andWhere('note.id < :untilId', { untilId })
				.andWhere('note.id NOT IN (SELECT "noteId" FROM note_favorite WHERE "userId" = :userId)')
				.getMany();

			for (const note of notes) {
				if (pinnedNoteIds.includes(note.id)) {
					this.logger.debug(`Skipping note ${note.id} as it is pinned`);
					continue;
				}

				this.logger.debug(`Deleting note ${note.id}`);
				await this.noteDeleteService.delete(user, note, false, user);
			}
		}

		this.logger.succ('Done with note auto-delete');
	}
}
