<template>
<FormBase>
	<FormSuspense :p="init">
		<FormSwitch v-model:value="allowlistMode">{{ $ts.pluskey.allowlistModeDescription }}</FormSwitch>

		<FormGroup v-if="!allowlistMode">
			<FormTextarea v-model:value="blockedHosts">
				<span>{{ $ts.blockedInstances }}</span>
				<template #desc>{{ $ts.blockedInstancesDescription }}</template>
			</FormTextarea>
		</FormGroup>

		<FormGroup v-if="allowlistMode">
			<FormTextarea v-model:value="allowedHosts">
				<span>{{ $ts.pluskey.allowedInstances }}</span>
				<template #desc>{{ $ts.pluskey.allowedInstancesDescription }}</template>
			</FormTextarea>
		</FormGroup>

		<FormButton @click="save" primary><i class="fas fa-save"></i> {{ $ts.save }}</FormButton>
	</FormSuspense>
</FormBase>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FormSwitch from '@client/components/form/switch.vue';
import FormInput from '@client/components/form/input.vue';
import FormButton from '@client/components/form/button.vue';
import FormBase from '@client/components/form/base.vue';
import FormGroup from '@client/components/form/group.vue';
import FormTextarea from '@client/components/form/textarea.vue';
import FormInfo from '@client/components/form/info.vue';
import FormSuspense from '@client/components/form/suspense.vue';
import * as os from '@client/os';
import * as symbols from '@client/symbols';
import { fetchInstance } from '@client/instance';

export default defineComponent({
	components: {
		FormSwitch,
		FormInput,
		FormBase,
		FormGroup,
		FormButton,
		FormTextarea,
		FormInfo,
		FormSuspense,
	},

	emits: ['info'],

	data() {
		return {
			[symbols.PAGE_INFO]: {
				title: this.$ts.instanceBlocking,
				icon: 'fas fa-ban'
			},
			blockedHosts: '',
			allowedHosts: '',
			allowlistMode: false,
		}
	},

	async mounted() {
		this.$emit('info', this[symbols.PAGE_INFO]);
	},

	methods: {
		async init() {
			const meta = await os.api('meta', { detail: true });
			this.blockedHosts = meta.blockedHosts.join('\n');
			this.allowedHosts = meta.allowedHosts.join('\n');
			this.allowlistMode = meta.allowlistMode;
		},

		save() {
			const data = {
				allowlistMode: this.allowlistMode,
			};

			if (this.allowlistMode) {
				data.allowedHosts = this.allowedHosts.split('\n') || [];
			} else {
				data.blockedHosts = this.blockedHosts.split('\n') || [];
			}

			os.apiWithDialog('admin/update-meta', data)
			.then(() => {
				fetchInstance();
			});
		}
	}
});
</script>
