<template>
<div class="_gaps_m">
	<MkButton :disabled="!changed" :primary="changed" @click="save()"><i class="ph-check ph-bold ph-lg"></i> {{ i18n.ts.save }}</MkButton>
	<MkSwitch v-model="enable">
		{{ i18n.ts.enable }}
		<template #caption>When enabled, notes you post will automatically delete themselves if they are older than the given threshold age.</template>
	</MkSwitch>
	<MkInput v-model="threshold" type="number" :min="1">
		<template #suffix>{{ i18n.ts._time.minute }}</template>
		<template #caption>Note age threshold</template>
	</MkInput>
	<MkFolder>
		<template #label>{{ i18n.ts.selectFromPresets }}</template>
		<FormSplit :minWidth="100">
			<MkButton @click="setThreshold(WEEK_MINUTES)" inline small>{{ i18n.ts.oneWeek }}</MkButton>
			<MkButton @click="setThreshold(MONTH_MINUTES)" inline small>{{ i18n.ts.oneMonth }}</MkButton>
			<MkButton @click="setThreshold(YEAR_MINUTES)" inline small>{{ i18n.ts.oneYear }}</MkButton>
		</FormSplit>
	</MkFolder>
</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import FormSplit from '@/components/form/split.vue';
import MkFolder from '@/components/MkFolder.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/scripts/misskey-api.js';
import { i18n } from '@/i18n.js';
import { signinRequired } from '@/account.js';

const $i = signinRequired();

const enable = ref($i.autoDeleteNotes);
const threshold = ref($i.autoDeleteNotesMinutes);

const changed = computed(() => enable.value !== $i.autoDeleteNotes || threshold.value !== $i.autoDeleteNotesMinutes);

const DAY_MINUTES = 60 * 24;
const WEEK_MINUTES = 7 * DAY_MINUTES;
const MONTH_MINUTES = 30 * DAY_MINUTES;
const YEAR_MINUTES = 365 * DAY_MINUTES;

function setThreshold(value) {
	threshold.value = value;
}

async function save() {
	if (enable.value) {
		const { canceled } = await os.confirm({
			type: 'warning',
			text: 'This action may immediately delete notes older than the threshold value! Click ok to confirm.',
		});

		if (canceled) return;
	}

	misskeyApi('i/update', {
		autoDeleteNotes: !!enable.value,
		autoDeleteNotesMinutes: threshold.value,
	});
}
</script>
