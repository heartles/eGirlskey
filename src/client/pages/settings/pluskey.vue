<template>
<FormBase>
	<FormGroup>
		<template #label>{{ $ts.behavior }}</template>
		<FormSwitch v-model:value="localMentions">{{ $ts.pluskey.localMentions }}</FormSwitch>
	</FormGroup>

	<FormGroup>
		<template #label>{{ $ts.pluskey.translation }}</template>
	</FormGroup>
</FormBase>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FormSwitch from '@client/components/form/switch.vue';
import FormSelect from '@client/components/form/select.vue';
import FormRadios from '@client/components/form/radios.vue';
import FormBase from '@client/components/form/base.vue';
import FormGroup from '@client/components/form/group.vue';
import FormLink from '@client/components/form/link.vue';
import FormButton from '@client/components/form/button.vue';
import MkLink from '@client/components/link.vue';
import { langs } from '@client/config';
import { defaultStore } from '@client/store';
import { ColdDeviceStorage } from '@client/store';
import * as os from '@client/os';
import { unisonReload } from '@client/scripts/unison-reload';
import * as symbols from '@client/symbols';

export default defineComponent({
	components: {
		MkLink,
		FormSwitch,
		FormSelect,
		FormRadios,
		FormBase,
		FormGroup,
		FormLink,
		FormButton,
	},

	emits: ['info'],

	data() {
		return {
			[symbols.PAGE_INFO]: {
				title: this.$ts.general,
				icon: 'fas fa-cogs'
			},
			langs,
			lang: localStorage.getItem('lang'),
			fontSize: localStorage.getItem('fontSize'),
			useSystemFont: localStorage.getItem('useSystemFont') != null,
		}
	},

	computed: {
		keepCw: defaultStore.makeGetterSetter('keepCw'),
		localMentions: defaultStore.makeGetterSetter('localMentions'),
	},

	mounted() {
		this.$emit('info', this[symbols.PAGE_INFO]);
	},

	methods: {
		async reloadAsk() {
			const { canceled } = await os.dialog({
				type: 'info',
				text: this.$ts.reloadToApplySetting,
				showCancelButton: true
			});
			if (canceled) return;

			unisonReload();
		}
	}
});
</script>
