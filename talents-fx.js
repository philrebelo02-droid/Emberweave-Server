/* Talents in a fight: shared by the page and the server's battle host (it runs this same file). No rendering, no RNG.
   DATA is built by tools/build_talent_fx.py from talents-data.js - do not edit it by hand.
   Phil 14 Nov 2026: "they are only activated when someone clicks learn talent" - nothing here runs for a hero with no learned talents:
   the callers skip an empty list, so such a hero is built by exactly the code that built it before talents existed.
   list = TALENTS.learned(hero, build) = [[talentId, rank], ...] sorted by id. */
(function(root,factory){const v=factory();if(typeof module==='object'&&module.exports)module.exports=v;if(root)root.TalentFx=v;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DATA={"stats":{"absalie":{"ec_4_3":{"hp":0.02},"ec_6_4":{"mr":0.02},"ec_7_3":{"apow":0.02},"gk_1_2":{"apow":0.02},"gk_5_4":{"apow":0.02,"hp":-0.01},"gk_7_3":{"hp":0.02},"us_1_3":{"hp":0.02},"us_2_4":{"apow":0.02},"us_8_4":{"mr":0.02}},"aldren":{"be_5_4":{"hp":0.02},"be_6_4":{"armor":0.02},"be_9_4":{"apow":0.02},"lb_3_3":{"armor":0.02},"lb_6_3":{"aspd":0.01},"lb_8_3":{"apow":0.02},"rw_1_3":{"atk":0.02},"rw_6_4":{"mr":0.02},"rw_9_3":{"apow":0.02}},"ambrel":{"gt_12_3":{"mr":0.02},"gt_2_3":{"apow":0.02},"gt_3_3":{"hp":0.02},"ip_1_2":{"hp":0.02},"ip_3_2":{"heal":0.02},"ip_8_2":{"mr":0.01},"rh_12_3":{"mr":0.02},"rh_1_3":{"hp":0.02},"rh_3_3":{"armor":0.02}},"askel":{"ch_1_3":{"atk":0.02},"ch_2_3":{"aspd":0.02},"ch_3_3":{"crit":0.01},"fd_1_3":{"hp":0.02},"fd_3_3":{"armor":0.02},"fd_6_1":{"mr":0.02},"st_10_2":{"armor":0.02},"st_2_2":{"atk":0.02},"st_3_2":{"hp":0.02}},"astra":{"hs_11_2":{"apow":0.02,"hp":-0.01},"hs_3_1":{"apow":0.02},"hs_7_4":{"hp":0.01},"sb_10_1":{"hp":0.02},"sb_11_2":{"apow":0.02},"sb_12_4":{"mr":0.02},"ss_1_4":{"hp":0.02},"ss_2_4":{"apow":0.02},"ss_8_1":{"armor":0.01}},"aureth":{"hb_12_1":{"crit":0.01},"hb_1_3":{"apow":0.02},"hb_6_2":{"critDmg":0.03},"hb_8_1":{"hp":0.02},"mb_2_2":{"apow":0.02},"mb_5_4":{"armor":0.01},"mb_9_2":{"hp":0.02},"tb_1_2":{"apow":0.02,"hp":-0.01},"tb_6_3":{"apow":0.02},"tb_8_2":{"aspd":0.02},"tb_9_2":{"critDmg":0.03}},"bloatus":{"dc_1_2":{"hp":0.02},"dc_3_2":{"armor":0.01},"dc_n2":{"hp":0.02},"km_1_3":{"hp":0.02},"km_3_3":{"armor":0.01},"km_n1":{"hp":0.02},"pk_10_3":{"hp":0.02},"pk_12_3":{"mr":0.02},"pk_3_3":{"apow":0.02}},"brannus":{"bw_1_2":{"atk":0.02},"bw_3_2":{"crit":0.01},"bw_9_2":{"armor":0.02},"cc_2_3":{"atk":0.02},"cc_3_3":{"hp":0.02},"cc_7_3":{"crit":0.01},"lp_1_3":{"hp":0.02},"lp_7_3":{"atk":0.02},"lp_8_3":{"mr":0.01}},"calypsa":{"nb_1_3":{"apow":0.02,"atk":0.02},"nb_3_3":{"hp":0.01},"nb_9_3":{"crit":0.01},"pp_11_4":{"apow":0.02},"pp_4_4":{"aspd":0.02},"pp_6_4":{"hp":0.03},"sl_1_2":{"apow":0.02},"sl_2_4":{"crit":0.015},"sl_8_2":{"atk":0.02}},"carn":{"bt_3_3":{"hp":0.01},"bt_8_1":{"critDmg":0.03},"bt_8_3":{"atk":0.02},"bt_9_3":{"armor":0.01},"fc_1_2":{"hp":0.02},"fc_2_3":{"atk":0.02},"fc_8_3":{"crit":0.01},"pr_11_4":{"atk":0.02},"pr_2_3":{"hp":0.02},"pr_7_1":{"critDmg":0.03},"pr_8_1":{"aspd":0.01}},"ceraline":{"gl_1_3":{"apow":0.02},"gl_6_4":{"mr":0.02},"gl_8_3":{"apow":0.02,"hp":-0.01},"ho_1_2":{"hp":0.02},"ho_7_4":{"apow":0.02},"ho_8_4":{"mr":0.02},"nc_11_4":{"armor":0.02},"nc_2_3":{"apow":0.02},"nc_5_4":{"apow":0.02,"hp":-0.02}},"dandra":{"gl_1_2":{"heal":0.02},"gl_3_2":{"hp":0.02},"gl_6_4":{"armor":0.01,"mr":0.01},"pb_11_4":{"armor":0.01,"mr":0.01},"pb_3_3":{"heal":0.02},"pb_3_4":{"hp":0.02},"tb_12_1":{"apow":0.02},"tb_3_4":{"hp":0.02},"tb_7_4":{"armor":0.01,"mr":0.01}},"deepcleft":{"nd_10_1":{"crit":0.015},"nd_11_4":{"hp":0.02},"nd_2_3":{"armor":0.02},"sr_11_1":{"atk":0.02},"sr_2_3":{"hp":0.02},"sr_6_4":{"armor":0.03},"sr_8_3":{"critDmg":0.03},"um_11_3":{"hp":0.02},"um_5_1":{"atk":0.02},"um_7_1":{"aspd":0.01}},"fritz":{"hh_12_4":{"armor":0.02},"hh_7_4":{"hp":0.02},"hh_n1":{"apow":0.02},"lw_10_1":{"hp":0.02},"lw_1_2":{"apow":0.02},"lw_n2":{"apow":0.02,"armor":-0.01},"sc_10_4":{"mr":0.02},"sc_2_4":{"hp":0.02},"sc_9_4":{"apow":0.02}},"grimsby":{"ci_1_3":{"atk":0.02},"ci_3_3":{"hp":0.01},"ci_8_3":{"crit":0.01},"ci_9_3":{"critDmg":0.03},"ev_1_2":{"hp":0.02},"ev_4_1":{"armor":0.02},"ev_5_1":{"mr":0.01},"ev_9_3":{"critDmg":0.03},"ne_1_3":{"atk":0.02},"ne_3_3":{"hp":0.01},"ne_8_3":{"crit":0.01},"ne_9_3":{"critDmg":0.03}},"grosk":{"mw_12_3":{"hp":0.02},"mw_2_3":{"hp":0.02},"mw_3_3":{"mr":0.02},"oj_1_2":{"atk":0.02},"oj_2_2":{"aspd":0.02},"oj_3_2":{"crit":0.01},"oj_7_2":{"critDmg":0.03},"sh_1_3":{"hp":0.02},"sh_3_3":{"armor":0.01},"sh_n1":{"hp":0.02}},"gruel":{"ap_1_3":{"hp":0.02},"ap_3_3":{"armor":0.01},"ap_9_3":{"hp":0.02},"bs_2_2":{"atk":0.02},"bs_3_2":{"hp":0.02},"bs_7_2":{"armor":0.01},"bs_8_4":{"critDmg":0.03},"le_1_3":{"hp":0.02},"le_3_3":{"atk":0.02},"le_7_3":{"crit":0.01}},"hero61":{"ig_11_1":{"hp":0.02},"ig_1_4":{"armor":0.02},"ig_6_2":{"armor":0.01,"mr":0.01},"oh_10_3":{"heal":0.02},"oh_3_3":{"hp":0.02},"oh_8_3":{"armor":0.01,"mr":0.01},"rb_1_2":{"heal":0.02},"rb_3_1":{"armor":0.01,"mr":0.01},"rb_3_2":{"hp":0.02}},"hobb":{"ct_12_2":{"critDmg":0.04},"ct_1_1":{"armor":0.02},"ct_5_4":{"mr":0.01},"ct_9_2":{"hp":0.02},"ow_12_2":{"aspd":0.02},"ow_1_2":{"atk":0.02},"ow_8_3":{"critDmg":0.03},"ow_8_4":{"hp":0.02},"rf_1_3":{"atk":0.02},"rf_6_2":{"critDmg":0.03},"rf_7_1":{"aspd":0.01},"rf_8_1":{"hp":0.02}},"hollow":{"co_1_3":{"crit":0.01},"co_6_4":{"hp":0.02},"co_n4":{"atk":0.02},"ec_1_2":{"atk":0.02},"ec_2_3":{"aspd":0.02},"ec_4_3":{"armor":0.02},"sb_1_3":{"armor":0.02,"mr":0.02},"sb_4_1":{"hp":0.02},"sb_8_1":{"crit":0.01}},"hurne":{"br_11_3":{"hp":0.02},"br_12_1":{"mr":0.02},"br_1_3":{"armor":0.02},"br_9_3":{"critDmg":0.03},"ft_1_4":{"hp":0.02},"ft_4_3":{"atk":0.02},"ft_6_1":{"critDmg":0.03},"ft_7_3":{"crit":0.01},"sw_10_3":{"crit":0.01},"sw_1_2":{"atk":0.02},"sw_7_4":{"hp":0.02},"sw_9_2":{"critDmg":0.03}},"iver":{"lr_1_2":{"hp":0.02},"lr_4_1":{"armor":0.02},"lr_5_1":{"mr":0.01},"sf_1_3":{"atk":0.02},"sf_3_3":{"hp":0.02},"sf_8_1":{"aspd":0.01},"sf_8_3":{"critDmg":0.03},"ts_1_3":{"atk":0.02},"ts_4_3":{"crit":0.015},"ts_8_1":{"aspd":0.01},"ts_8_3":{"critDmg":0.03}},"joss":{"hm_1_3":{"hp":0.02},"hm_3_3":{"armor":0.02},"hm_8_3":{"mr":0.01},"pr_2_2":{"apow":0.02},"pr_3_2":{"hp":0.02},"pr_8_2":{"armor":0.02},"ra_11_3":{"critDmg":0.03},"ra_1_3":{"apow":0.02},"ra_2_3":{"aspd":0.02},"ra_3_3":{"crit":0.01}},"kharos":{"lu_1_3":{"atk":0.02},"lu_4_1":{"hp":0.015},"lu_6_4":{"mr":0.02},"sh_11_3":{"crit":0.01},"sh_1_3":{"atk":0.02},"sh_4_1":{"hp":0.015},"wo_1_2":{"crit":0.01},"wo_2_3":{"aspd":0.02},"wo_n2":{"atk":0.02}},"konwu":{"gp_2_2":{"hp":0.02},"gp_3_2":{"armor":0.02},"gp_5_4":{"mr":0.01},"nf_1_3":{"atk":0.02},"nf_8_3":{"hp":0.02},"nf_9_3":{"crit":0.01},"ru_12_4":{"aspd":0.01},"ru_1_2":{"atk":0.02},"ru_8_2":{"hp":0.02},"ru_9_2":{"critDmg":0.03}},"korvux":{"bs_1_2":{"atk":0.02},"bs_8_2":{"aspd":0.02},"bs_8_3":{"critDmg":0.03},"bs_8_4":{"hp":0.02},"pp_1_1":{"crit":0.01},"pp_2_2":{"atk":0.02},"pp_6_1":{"critDmg":0.05},"pp_8_2":{"hp":0.02},"rh_11_4":{"hp":0.02},"rh_2_3":{"atk":0.02},"rh_8_1":{"critDmg":0.03},"rh_8_3":{"armor":0.02}},"linnet":{"gl_1_4":{"heal":0.02},"gl_2_4":{"hp":0.02},"gl_3_4":{"armor":0.01,"mr":0.01},"ml_11_4":{"armor":0.01,"mr":0.01},"ml_3_4":{"heal":0.02},"ml_6_1":{"apow":0.02},"sh_11_1":{"armor":0.01,"mr":0.01},"sh_12_4":{"apow":0.02},"sh_3_2":{"hp":0.02}},"lumi":{"fl_12_4":{"apow":0.02},"fl_1_1":{"aspd":0.02},"fl_7_1":{"hp":0.01},"fm_1_4":{"heal":0.02},"fm_2_4":{"hp":0.02},"fm_9_4":{"armor":0.01,"mr":0.01},"qh_11_4":{"armor":0.01,"mr":0.01},"qh_12_3":{"apow":0.02},"qh_3_3":{"hp":0.02}},"lysara":{"lm_12_4":{"mr":0.01},"lm_5_1":{"hp":0.02},"lm_6_2":{"apow":0.02},"ln_12_4":{"mr":0.02},"ln_9_3":{"apow":0.02},"ln_n3":{"aspd":0.02},"sd_10_4":{"hp":0.02},"sd_11_4":{"armor":0.02},"sd_1_3":{"heal":0.02}},"maren":{"gb_11_1":{"apow":0.02},"gb_2_4":{"hp":0.02},"gb_3_1":{"heal":0.02},"gb_8_1":{"mr":0.01},"oh_10_3":{"apow":0.01},"oh_1_2":{"armor":0.02},"oh_7_1":{"hp":0.02},"sf_10_1":{"hp":0.02},"sf_12_4":{"armor":0.02},"sf_1_2":{"apow":0.02}},"mellan":{"gr_12_1":{"heal":0.02},"gr_2_4":{"hp":0.02},"gr_7_4":{"armor":0.01,"mr":0.01},"ls_12_3":{"apow":0.02},"ls_3_3":{"hp":0.02},"ls_8_3":{"armor":0.01,"mr":0.01},"rm_12_4":{"heal":0.02},"rm_2_1":{"hp":0.02},"rm_3_4":{"apow":0.01}},"meridian":{"gi_12_3":{"aspd":0.02},"gi_1_3":{"atk":0.02},"gi_8_3":{"crit":0.01},"ls_1_2":{"crit":0.01},"ls_7_2":{"armor":0.01,"mr":0.01},"ls_9_2":{"atk":0.02},"ty_1_2":{"atk":0.02},"ty_3_2":{"hp":0.01},"ty_7_2":{"armor":0.01,"mr":0.01}},"mirelle":{"he_1_2":{"hp":0.02},"he_3_1":{"armor":0.01,"mr":0.01},"he_3_2":{"apow":0.02},"lp_12_1":{"apow":0.02},"lp_3_4":{"hp":0.02},"lp_7_1":{"aspd":0.01},"rw_11_4":{"armor":0.01,"mr":0.01},"rw_3_4":{"heal":0.02},"rw_7_1":{"apow":0.02}},"nerisse":{"ds_1_4":{"heal":0.02},"ds_5_2":{"apow":0.02},"ds_7_4":{"armor":0.01,"mr":0.01},"sb_12_4":{"apow":0.02},"sb_2_1":{"hp":0.02},"sb_5_3":{"armor":0.01,"mr":0.01},"wh_11_4":{"heal":0.02},"wh_3_3":{"hp":0.02},"wh_8_3":{"armor":0.01,"mr":0.01}},"nox":{"fe_10_4":{"armor":0.01},"fe_1_3":{"apow":0.02},"fe_4_1":{"hp":0.02},"jb_1_3":{"crit":0.01},"jb_6_4":{"aspd":0.02},"jb_n4":{"apow":0.02},"lf_10_4":{"mr":0.01},"lf_11_3":{"crit":0.01},"lf_1_3":{"apow":0.02}},"oakmir":{"hw_10_3":{"apow":0.02},"hw_1_3":{"heal":0.02},"hw_6_4":{"armor":0.025},"tw_12_1":{"apow":0.02},"tw_3_4":{"hp":0.02},"tw_7_4":{"armor":0.01,"mr":0.01},"ty_1_2":{"heal":0.02},"ty_3_2":{"hp":0.02},"ty_7_4":{"apow":0.01}},"orryn":{"fc_11_2":{"apow":0.02,"hp":-0.01},"fc_1_2":{"apow":0.02},"fc_7_4":{"hp":0.01},"os_11_1":{"apow":0.02},"os_1_4":{"hp":0.02},"os_8_1":{"mr":0.02},"sp_12_4":{"armor":0.02},"sp_1_3":{"apow":0.02},"sp_7_4":{"hp":0.02}},"pellucid":{"fm_1_3":{"atk":0.02},"fm_3_3":{"crit":0.01},"fm_7_3":{"critDmg":0.03},"fm_n1":{"atk":0.02},"gc_2_3":{"armor":0.02},"gc_3_3":{"hp":0.02},"gc_8_3":{"mr":0.02},"rk_1_2":{"hp":0.02},"rk_3_2":{"armor":0.02},"rk_n1":{"mr":0.02}},"pyroclast":{"db_10_3":{"hp":0.02},"db_6_2":{"apow":0.02},"db_8_4":{"mr":0.02},"er_1_2":{"apow":0.02},"er_7_3":{"apow":0.02,"hp":-0.01},"er_9_4":{"hp":0.01},"nh_4_1":{"armor":0.02},"nh_7_3":{"apow":0.02},"nh_8_4":{"mr":0.02}},"quorrel":{"ed_10_3":{"aspd":0.02},"ed_2_3":{"atk":0.02},"ed_6_4":{"critDmg":0.04},"ed_9_4":{"hp":0.01},"oc_12_4":{"armor":0.02},"oc_1_1":{"hp":0.02},"oc_2_2":{"atk":0.02},"oc_6_1":{"critDmg":0.05},"sg_1_3":{"atk":0.02},"sg_5_4":{"crit":0.01},"sg_6_2":{"critDmg":0.03},"sg_8_1":{"hp":0.02}},"rafe":{"co_12_2":{"atk":0.02},"co_1_4":{"hp":0.01},"co_7_4":{"armor":0.02},"fs_10_4":{"aspd":0.02,"hp":-0.01},"fs_1_2":{"crit":0.01},"fs_7_2":{"aspd":0.02},"ss_12_3":{"aspd":0.01},"ss_4_1":{"atk":0.02},"ss_8_4":{"armor":0.01}},"rhukk":{"eb_10_2":{"armor":0.01},"eb_1_3":{"hp":0.02},"eb_3_3":{"atk":0.02},"eb_6_2":{"critDmg":0.03},"ot_1_2":{"armor":0.02},"ot_2_2":{"hp":0.02},"ot_5_4":{"mr":0.01},"st_1_4":{"hp":0.02},"st_2_3":{"atk":0.02},"st_6_2":{"critDmg":0.03},"st_7_3":{"crit":0.01}},"rivet":{"cw_1_2":{"hp":0.02},"cw_2_3":{"atk":0.02},"cw_8_3":{"armor":0.01},"cw_9_3":{"critDmg":0.03},"lw_1_3":{"atk":0.02},"lw_3_3":{"hp":0.01},"lw_8_1":{"aspd":0.01},"lw_9_3":{"critDmg":0.03},"nc_1_3":{"hp":0.02},"nc_4_3":{"armor":0.02},"nc_5_1":{"atk":0.01}},"seyla":{"bl_1_2":{"crit":0.01},"bl_4_1":{"hp":0.01},"bl_n1":{"atk":0.02},"ct_10_4":{"armor":0.01},"ct_11_3":{"crit":0.01},"ct_1_3":{"atk":0.02},"tc_10_2":{"armor":0.01},"tc_1_3":{"atk":0.02},"tc_4_1":{"hp":0.015}},"sloe":{"eq_12_3":{"aspd":0.02},"eq_3_4":{"atk":0.02},"eq_9_4":{"crit":0.01},"om_12_2":{"atk":0.02,"hp":-0.01},"om_1_4":{"atk":0.02},"om_2_2":{"crit":0.01},"tw_3_3":{"atk":0.02},"tw_8_3":{"hp":0.01},"tw_9_3":{"crit":0.01}},"sorrel":{"hc_10_4":{"atk":0.02},"hc_1_2":{"crit":0.01},"hc_4_1":{"hp":0.01},"sc_11_3":{"crit":0.01},"sc_1_3":{"atk":0.02},"sc_2_3":{"aspd":0.02},"sd_11_3":{"crit":0.01},"sd_1_3":{"atk":0.02},"sd_4_1":{"hp":0.01}},"sylthaine":{"sp_3_3":{"apow":0.02},"sp_n2":{"aspd":0.01},"sw_10_4":{"hp":0.02},"sw_1_2":{"armor":0.02,"mr":0.02},"sw_2_3":{"heal":0.02,"shield":0.02},"ws_12_1":{"hp":0.02},"ws_1_3":{"apow":0.02},"ws_n1":{"crit":0.015}},"tessit":{"bg_12_4":{"apow":0.02},"bg_2_1":{"hp":0.02},"bg_7_1":{"armor":0.01,"mr":0.01},"lg_12_1":{"apow":0.02},"lg_2_4":{"hp":0.02},"lg_7_4":{"armor":0.01,"mr":0.01},"uw_10_3":{"armor":0.01,"mr":0.01},"uw_12_3":{"heal":0.02},"uw_1_3":{"hp":0.02}},"tharl":{"rc_2_3":{"hp":0.02},"rc_3_3":{"armor":0.02},"rc_9_3":{"mr":0.01},"sb_1_2":{"atk":0.02},"sb_7_2":{"critDmg":0.03},"sb_8_2":{"armor":0.01},"sb_n1":{"atk":0.02},"se_12_3":{"mr":0.02},"se_1_3":{"hp":0.02},"se_3_3":{"armor":0.02}},"tick":{"bw_2_2":{"armor":0.02},"bw_5_4":{"mr":0.01},"bw_9_2":{"hp":0.02},"kb_12_2":{"crit":0.01},"kb_1_2":{"atk":0.02},"kb_7_2":{"critDmg":0.03},"kb_8_3":{"hp":0.02},"sq_1_4":{"aspd":0.02},"sq_2_3":{"hp":0.01},"sq_7_3":{"atk":0.02},"sq_8_1":{"critDmg":0.03}},"tolley":{"lf_1_3":{"hp":0.02},"lf_2_2":{"armor":0.02},"lf_7_1":{"mr":0.01},"mp_1_3":{"atk":0.02},"mp_3_3":{"hp":0.02},"mp_8_1":{"armor":0.01},"mp_8_3":{"critDmg":0.03},"wm_1_2":{"hp":0.02},"wm_2_3":{"atk":0.02},"wm_4_3":{"armor":0.02}},"umbris":{"oc_2_1":{"hp":0.02},"oc_8_4":{"armor":0.01},"oc_9_1":{"apow":0.02},"sd_10_4":{"hp":0.02},"sd_11_3":{"apow":0.02},"sd_12_1":{"mr":0.02},"wl_10_2":{"apow":0.02},"wl_11_2":{"armor":0.01,"mr":0.01},"wl_7_4":{"hp":0.02}},"vael":{"aw_n1":{"armor":0.02},"aw_n2":{"mr":0.02},"aw_n3":{"hp":0.02},"ib_1_3":{"hp":0.02},"ib_4_3":{"armor":0.02},"ib_n2":{"atk":0.02},"rh_1_3":{"crit":0.01},"rh_6_4":{"atk":0.02,"hp":-0.01},"rh_n1":{"aspd":0.02}},"vaelora":{"pc_10_4":{"hp":0.02},"pc_11_3":{"apow":0.02,"hp":-0.01},"pc_1_3":{"apow":0.02},"pc_7_1":{"critDmg":0.02},"tw_12_1":{"armor":0.01,"mr":0.01},"tw_2_1":{"hp":0.02},"tw_8_4":{"critDmg":0.02},"tw_9_1":{"apow":0.02},"wc_10_2":{"apow":0.02},"wc_11_2":{"armor":0.02},"wc_7_4":{"hp":0.01}},"vesper":{"rp_10_4":{"mr":0.02},"rp_5_1":{"hp":0.02},"rp_9_3":{"apow":0.02},"sc_1_2":{"hp":0.02},"sc_4_3":{"apow":0.02},"sc_8_4":{"armor":0.015,"mr":0.015},"sv_10_3":{"apow":0.02,"hp":-0.02},"sv_11_4":{"armor":0.02},"sv_2_2":{"apow":0.02}},"vex":{"rw_1_3":{"crit":0.01},"rw_n1":{"atk":0.02,"hp":-0.01},"rw_n2":{"aspd":0.01},"sc_1_3":{"atk":0.02},"sc_n1":{"aspd":0.02},"sc_n2":{"hp":0.01},"sl_2_3":{"hp":0.02},"sl_3_3":{"crit":0.01},"sl_n2":{"atk":0.02}},"veyr":{"oh_1_2":{"armor":0.02},"oh_4_1":{"hp":0.02},"oh_n2":{"apow":0.01},"tl_10_1":{"aspd":0.01},"tl_1_3":{"crit":0.01},"tl_n2":{"apow":0.02},"tr_12_3":{"crit":0.01},"tr_1_3":{"apow":0.02},"tr_6_4":{"mr":0.02}},"vireo":{"ds_7_1":{"apow":0.02},"ds_n2":{"armor":0.01,"mr":0.01},"lh_1_3":{"heal":0.02},"lh_3_4":{"hp":0.01},"lh_7_1":{"apow":0.02},"li_12_3":{"apow":0.02},"li_2_3":{"hp":0.02},"li_8_3":{"heal":0.01}},"vulmar":{"fb_12_1":{"hp":0.02},"fb_3_4":{"apow":0.02},"fb_7_4":{"apow":0.02,"armor":-0.01,"mr":-0.01},"gw_10_4":{"hp":0.02},"gw_11_3":{"armor":0.02,"mr":0.02},"gw_1_3":{"apow":0.02},"rl_11_4":{"apow":0.02},"rl_2_1":{"hp":0.02},"rl_8_4":{"armor":0.01}},"yenna":{"af_12_3":{"mr":0.02},"af_1_4":{"hp":0.02},"af_2_4":{"armor":0.02},"pl_2_3":{"crit":0.015},"pl_3_3":{"atk":0.02},"pl_9_3":{"armor":0.01,"hp":0.01},"wb_12_3":{"atk":0.02},"wb_1_2":{"crit":0.01},"wb_9_3":{"aspd":0.01}},"zahri":{"hr_11_4":{"armor":0.02},"hr_1_3":{"atk":0.012,"hp":0.012},"hr_5_1":{"aspd":0.01},"hr_9_3":{"critDmg":0.03},"rn_11_4":{"atk":0.02},"rn_2_3":{"crit":0.01},"rn_3_3":{"hp":0.01},"rn_8_1":{"critDmg":0.03},"sn_10_2":{"armor":0.02},"sn_1_2":{"atk":0.02},"sn_2_3":{"crit":0.01},"sn_8_1":{"critDmg":0.03}}},"v":2};
  /* total of each stat for a learned list: { hp: 0.10, atk: 0.04, ... } (fraction; negative = a RISK talent's cost). Unknown ids and
     ids with no stat part add nothing, so a list saved under older data never throws. */
  function totals(hero,list){ const S=DATA.stats[hero], out={}; if(!S||!list) return out;
    for(const e of list){ const f=S[e[0]], r=e[1]|0; if(!f||r<1) continue; for(const k in f) out[k]=(out[k]||0)+f[k]*r; }
    return out; }
  /* The stat talents on a finished real-engine unit (called once, at the end of makeUnit). "N% more" multiplies the finished number;
     crit chance is added (the engine's 60% cap stays); critical damage multiplies the whole critical hit. */
  function applyStats(u,hero,list){ const T=totals(hero,list);
    if(T.hp){ const k=Math.max(0.05,1+T.hp); u.maxHp*=k; u.hp=u.maxHp; }
    if(T.atk) u.dmg*=Math.max(0.05,1+T.atk);
    if(T.apow) u.apow=(u.apow||0)*Math.max(0.05,1+T.apow);
    if(T.armor) u.armorRating=(u.armorRating||0)*Math.max(0,1+T.armor);
    if(T.mr) u.mrRating=(u.mrRating||0)*Math.max(0,1+T.mr);
    if(T.crit) u.glyphCrit=Math.max(0,Math.min(0.6,(u.glyphCrit||0)+T.crit));
    if(T.critDmg) u.critDmg=(1+(u.critDmg||0.6))*Math.max(0.05,1+T.critDmg)-1;
    if(T.aspd) u.atkInterval=u.atkInterval/Math.max(0.05,1+T.aspd);
    if(T.heal) u.healPowMul=(u.healPowMul||1)*Math.max(0.05,1+T.heal);
    if(T.shield) u.shieldStrMul=(u.shieldStrMul||1)*Math.max(0.05,1+T.shield);
    return T; }
  /* The same stat talents on a LINE-MODEL unit (server/combat-core.js buildUnit, built by server.js snapshotHeroFromServer: Arena, Skyfall,
     the Trial, NPC castles, and the unit the server prices the power number from). Same fractions, the line model's field names:
       hp      -> maxHp   (whole points, as the core rounds them; the line starts every fight at maxHp and shieldPool at 0, so nothing else is derived)
       atk     -> atkP    (whole points)
       apow    -> atkM    (whole points) and `heal`, the healer's heal number, which the core derives from ability power
       armor   -> armor,  mr -> mr   (finished ratings, as the client's armorRating / mrRating)
       crit    -> crit    (a FRACTION here, added; the core's 60% cap stays)
       critDmg -> critDmg (the bonus fraction, 0.6 = +60%): the whole critical hit x(1+n), as applyStats
       aspd    -> speed   (attacks per swing timer, the inverse of the client's atkInterval; `haste` is energy gain, not attack speed)
       heal    -> healPow (a fraction the core applies as x(1+healPow)): x(1+n) on the whole multiplier, as the client's healPowMul
       shield  -> shieldStr (a multiplier)
     Not called with an empty list. The caller refreshes the unit's legacy aliases (atk, dr) afterwards. */
  function applyCore(u,hero,list){ if(!u) return u; const T=totals(hero,list);
    if(T.hp) u.maxHp=Math.round(u.maxHp*Math.max(0.05,1+T.hp));
    if(T.atk) u.atkP=Math.round((u.atkP||0)*Math.max(0.05,1+T.atk));
    if(T.apow){ const k=Math.max(0.05,1+T.apow); u.atkM=Math.round((u.atkM||0)*k); if(u.heal) u.heal=Math.round(u.heal*k); }
    if(T.armor) u.armor=(u.armor||0)*Math.max(0,1+T.armor);
    if(T.mr) u.mr=(u.mr||0)*Math.max(0,1+T.mr);
    if(T.crit) u.crit=Math.max(0,Math.min(0.6,(u.crit||0)+T.crit));
    if(T.critDmg) u.critDmg=(1+(u.critDmg||0.6))*Math.max(0.05,1+T.critDmg)-1;
    if(T.aspd) u.speed=(u.speed||1)*Math.max(0.05,1+T.aspd);
    if(T.heal) u.healPow=(1+(u.healPow||0))*Math.max(0.05,1+T.heal)-1;
    if(T.shield) u.shieldStr=(u.shieldStr||1)*Math.max(0.05,1+T.shield);
    return u; }
  const has=(hero,id)=>!!(DATA.stats[hero]&&DATA.stats[hero][id]);
  const TREES={"absalie":{"ids":["empty_chair","great_knot","the_unsaid"],"of":{"ec_10_1":0,"ec_10_2":0,"ec_10_3":0,"ec_11_2":0,"ec_11_3":0,"ec_11_4":0,"ec_12_1":0,"ec_12_2":0,"ec_12_3":0,"ec_13_3":0,"ec_1_1":0,"ec_1_3":0,"ec_1_4":0,"ec_2_1":0,"ec_2_2":0,"ec_2_4":0,"ec_3_1":0,"ec_3_4":0,"ec_4_1":0,"ec_4_2":0,"ec_4_3":0,"ec_5_1":0,"ec_5_2":0,"ec_5_3":0,"ec_5_4":0,"ec_6_1":0,"ec_6_2":0,"ec_6_4":0,"ec_7_1":0,"ec_7_2":0,"ec_7_3":0,"ec_7_4":0,"ec_8_2":0,"ec_8_3":0,"ec_8_4":0,"ec_9_1":0,"ec_9_3":0,"ec_9_4":0,"ec_n1":0,"ec_n2":0,"gk_10_1":1,"gk_10_3":1,"gk_10_4":1,"gk_11_1":1,"gk_11_2":1,"gk_11_4":1,"gk_12_1":1,"gk_12_2":1,"gk_12_4":1,"gk_13_2":1,"gk_1_1":1,"gk_1_2":1,"gk_1_4":1,"gk_2_1":1,"gk_2_3":1,"gk_2_4":1,"gk_3_1":1,"gk_3_2":1,"gk_3_3":1,"gk_3_4":1,"gk_4_2":1,"gk_4_3":1,"gk_4_4":1,"gk_5_1":1,"gk_5_2":1,"gk_5_3":1,"gk_5_4":1,"gk_6_1":1,"gk_6_2":1,"gk_6_4":1,"gk_7_1":1,"gk_7_2":1,"gk_7_3":1,"gk_7_4":1,"gk_8_2":1,"gk_8_3":1,"gk_8_4":1,"gk_9_1":1,"gk_9_2":1,"gk_9_3":1,"us_10_1":2,"us_10_3":2,"us_10_4":2,"us_11_1":2,"us_11_3":2,"us_11_4":2,"us_12_1":2,"us_12_3":2,"us_12_4":2,"us_13_3":2,"us_1_1":2,"us_1_3":2,"us_1_4":2,"us_2_1":2,"us_2_2":2,"us_2_4":2,"us_3_1":2,"us_3_2":2,"us_4_1":2,"us_4_2":2,"us_4_4":2,"us_5_1":2,"us_5_2":2,"us_5_3":2,"us_5_4":2,"us_6_1":2,"us_6_3":2,"us_6_4":2,"us_7_1":2,"us_7_2":2,"us_7_3":2,"us_8_2":2,"us_8_3":2,"us_8_4":2,"us_9_1":2,"us_9_2":2,"us_9_4":2,"us_n1":2}},"aldren":{"ids":["bestiary","rewrite","living_book"],"of":{"be_10_1":0,"be_10_2":0,"be_10_4":0,"be_11_1":0,"be_11_2":0,"be_11_3":0,"be_12_1":0,"be_12_2":0,"be_12_4":0,"be_13_2":0,"be_1_1":0,"be_1_2":0,"be_1_4":0,"be_2_1":0,"be_2_3":0,"be_2_4":0,"be_3_1":0,"be_3_3":0,"be_4_1":0,"be_4_2":0,"be_4_3":0,"be_5_1":0,"be_5_2":0,"be_5_3":0,"be_5_4":0,"be_6_1":0,"be_6_2":0,"be_6_4":0,"be_7_1":0,"be_7_2":0,"be_7_3":0,"be_8_1":0,"be_8_3":0,"be_8_4":0,"be_9_2":0,"be_9_3":0,"be_9_4":0,"be_n1":0,"lb_10_1":2,"lb_10_3":2,"lb_10_4":2,"lb_11_1":2,"lb_11_2":2,"lb_11_4":2,"lb_12_1":2,"lb_12_2":2,"lb_12_3":2,"lb_13_2":2,"lb_1_1":2,"lb_1_2":2,"lb_1_4":2,"lb_2_1":2,"lb_2_3":2,"lb_2_4":2,"lb_3_1":2,"lb_3_2":2,"lb_3_3":2,"lb_3_4":2,"lb_4_1":2,"lb_4_2":2,"lb_4_3":2,"lb_5_1":2,"lb_5_2":2,"lb_5_3":2,"lb_5_4":2,"lb_6_1":2,"lb_6_3":2,"lb_6_4":2,"lb_7_1":2,"lb_7_2":2,"lb_7_4":2,"lb_8_2":2,"lb_8_3":2,"lb_8_4":2,"lb_9_1":2,"lb_9_2":2,"lb_9_3":2,"rw_10_1":1,"rw_10_2":1,"rw_10_3":1,"rw_11_2":1,"rw_11_3":1,"rw_11_4":1,"rw_12_1":1,"rw_12_2":1,"rw_12_4":1,"rw_13_2":1,"rw_1_1":1,"rw_1_3":1,"rw_1_4":1,"rw_2_1":1,"rw_2_2":1,"rw_2_4":1,"rw_3_1":1,"rw_3_2":1,"rw_4_1":1,"rw_4_3":1,"rw_4_4":1,"rw_5_1":1,"rw_5_2":1,"rw_5_3":1,"rw_5_4":1,"rw_6_2":1,"rw_6_3":1,"rw_6_4":1,"rw_7_1":1,"rw_7_2":1,"rw_7_3":1,"rw_8_1":1,"rw_8_2":1,"rw_8_4":1,"rw_9_1":1,"rw_9_3":1,"rw_9_4":1,"rw_n1":1,"rw_n2":1}},"astra":{"ids":["slow_burn","held_star","second_sky"],"of":{"hs_10_1":1,"hs_10_2":1,"hs_10_3":1,"hs_11_1":1,"hs_11_2":1,"hs_11_4":1,"hs_12_2":1,"hs_12_3":1,"hs_12_4":1,"hs_13_3":1,"hs_1_1":1,"hs_1_3":1,"hs_1_4":1,"hs_2_1":1,"hs_2_2":1,"hs_2_4":1,"hs_3_1":1,"hs_3_3":1,"hs_3_4":1,"hs_4_1":1,"hs_4_2":1,"hs_4_3":1,"hs_5_2":1,"hs_5_3":1,"hs_5_4":1,"hs_6_1":1,"hs_6_2":1,"hs_6_4":1,"hs_7_1":1,"hs_7_2":1,"hs_7_4":1,"hs_8_1":1,"hs_8_3":1,"hs_8_4":1,"hs_9_2":1,"hs_9_3":1,"hs_9_4":1,"hs_n1":1,"hs_n2":1,"hs_n3":1,"sb_10_1":0,"sb_10_2":0,"sb_10_4":0,"sb_11_2":0,"sb_11_3":0,"sb_11_4":0,"sb_12_1":0,"sb_12_3":0,"sb_12_4":0,"sb_13_3":0,"sb_1_1":0,"sb_1_2":0,"sb_1_4":0,"sb_2_2":0,"sb_2_3":0,"sb_2_4":0,"sb_3_1":0,"sb_3_4":0,"sb_4_2":0,"sb_4_3":0,"sb_4_4":0,"sb_5_1":0,"sb_5_2":0,"sb_5_3":0,"sb_5_4":0,"sb_6_1":0,"sb_6_3":0,"sb_6_4":0,"sb_7_2":0,"sb_7_3":0,"sb_7_4":0,"sb_8_1":0,"sb_8_2":0,"sb_8_4":0,"sb_9_1":0,"sb_9_2":0,"sb_9_3":0,"sb_n1":0,"sb_n2":0,"sb_n3":0,"ss_10_1":2,"ss_10_3":2,"ss_10_4":2,"ss_11_1":2,"ss_11_2":2,"ss_11_3":2,"ss_12_1":2,"ss_12_2":2,"ss_12_4":2,"ss_13_2":2,"ss_1_1":2,"ss_1_3":2,"ss_1_4":2,"ss_2_1":2,"ss_2_3":2,"ss_2_4":2,"ss_3_1":2,"ss_3_2":2,"ss_3_3":2,"ss_4_1":2,"ss_4_2":2,"ss_4_4":2,"ss_5_1":2,"ss_5_2":2,"ss_5_3":2,"ss_5_4":2,"ss_6_1":2,"ss_6_3":2,"ss_6_4":2,"ss_7_2":2,"ss_7_3":2,"ss_7_4":2,"ss_8_1":2,"ss_8_2":2,"ss_8_3":2,"ss_9_1":2,"ss_9_2":2,"ss_9_4":2}},"sylthaine":{"ids":["winter_seal","shatterpoint","snowwarden"],"of":{"sp_10_1":1,"sp_10_3":1,"sp_10_4":1,"sp_11_2":1,"sp_11_3":1,"sp_11_4":1,"sp_12_1":1,"sp_12_2":1,"sp_12_4":1,"sp_13_2":1,"sp_1_1":1,"sp_1_3":1,"sp_1_4":1,"sp_2_1":1,"sp_2_2":1,"sp_2_3":1,"sp_3_1":1,"sp_3_3":1,"sp_3_4":1,"sp_4_1":1,"sp_4_2":1,"sp_4_3":1,"sp_5_1":1,"sp_5_2":1,"sp_5_3":1,"sp_5_4":1,"sp_6_2":1,"sp_6_3":1,"sp_6_4":1,"sp_7_1":1,"sp_7_2":1,"sp_7_4":1,"sp_8_1":1,"sp_8_3":1,"sp_8_4":1,"sp_9_2":1,"sp_9_3":1,"sp_9_4":1,"sp_n1":1,"sp_n2":1,"sw_10_1":2,"sw_10_3":2,"sw_10_4":2,"sw_11_1":2,"sw_11_2":2,"sw_11_4":2,"sw_12_2":2,"sw_12_3":2,"sw_12_4":2,"sw_13_2":2,"sw_1_1":2,"sw_1_2":2,"sw_1_4":2,"sw_2_1":2,"sw_2_3":2,"sw_2_4":2,"sw_3_1":2,"sw_3_2":2,"sw_4_1":2,"sw_4_2":2,"sw_4_3":2,"sw_5_1":2,"sw_5_2":2,"sw_5_3":2,"sw_5_4":2,"sw_6_1":2,"sw_6_2":2,"sw_6_3":2,"sw_7_2":2,"sw_7_3":2,"sw_7_4":2,"sw_8_1":2,"sw_8_3":2,"sw_8_4":2,"sw_9_2":2,"sw_9_3":2,"sw_9_4":2,"sw_n1":2,"ws_10_1":0,"ws_10_3":0,"ws_10_4":0,"ws_11_1":0,"ws_11_2":0,"ws_11_3":0,"ws_12_1":0,"ws_12_2":0,"ws_12_4":0,"ws_13_2":0,"ws_1_1":0,"ws_1_3":0,"ws_1_4":0,"ws_2_1":0,"ws_2_2":0,"ws_2_3":0,"ws_3_1":0,"ws_3_3":0,"ws_3_4":0,"ws_4_1":0,"ws_4_2":0,"ws_4_3":0,"ws_5_1":0,"ws_5_2":0,"ws_5_3":0,"ws_5_4":0,"ws_6_1":0,"ws_6_2":0,"ws_6_4":0,"ws_7_1":0,"ws_7_2":0,"ws_7_3":0,"ws_8_1":0,"ws_8_3":0,"ws_8_4":0,"ws_9_2":0,"ws_9_3":0,"ws_9_4":0,"ws_n1":0}},"vael":{"ids":["red_harvest","ironblood","ashford_wall"],"of":{"aw_10_1":2,"aw_10_3":2,"aw_10_4":2,"aw_11_1":2,"aw_11_2":2,"aw_11_4":2,"aw_12_1":2,"aw_12_2":2,"aw_12_3":2,"aw_12_4":2,"aw_13_2":2,"aw_1_1":2,"aw_1_3":2,"aw_1_4":2,"aw_2_1":2,"aw_2_2":2,"aw_2_3":2,"aw_3_1":2,"aw_3_3":2,"aw_3_4":2,"aw_4_1":2,"aw_4_2":2,"aw_4_3":2,"aw_4_4":2,"aw_5_1":2,"aw_5_2":2,"aw_5_3":2,"aw_5_4":2,"aw_6_1":2,"aw_6_2":2,"aw_6_3":2,"aw_6_4":2,"aw_7_1":2,"aw_7_2":2,"aw_7_4":2,"aw_8_1":2,"aw_8_3":2,"aw_8_4":2,"aw_9_1":2,"aw_9_2":2,"aw_9_4":2,"aw_n1":2,"aw_n2":2,"aw_n3":2,"ib_10_1":1,"ib_10_3":1,"ib_10_4":1,"ib_11_1":1,"ib_11_2":1,"ib_11_4":1,"ib_12_1":1,"ib_12_2":1,"ib_12_3":1,"ib_12_4":1,"ib_13_2":1,"ib_1_1":1,"ib_1_3":1,"ib_1_4":1,"ib_2_1":1,"ib_2_2":1,"ib_3_1":1,"ib_3_3":1,"ib_3_4":1,"ib_4_1":1,"ib_4_2":1,"ib_4_3":1,"ib_5_1":1,"ib_5_2":1,"ib_5_3":1,"ib_5_4":1,"ib_6_1":1,"ib_6_2":1,"ib_6_4":1,"ib_7_2":1,"ib_7_3":1,"ib_7_4":1,"ib_8_1":1,"ib_8_3":1,"ib_9_2":1,"ib_9_3":1,"ib_9_4":1,"ib_n1":1,"ib_n2":1,"rh_10_1":0,"rh_10_3":0,"rh_10_4":0,"rh_11_1":0,"rh_11_2":0,"rh_11_4":0,"rh_12_1":0,"rh_12_2":0,"rh_12_3":0,"rh_12_4":0,"rh_13_2":0,"rh_1_1":0,"rh_1_3":0,"rh_1_4":0,"rh_2_1":0,"rh_2_2":0,"rh_2_3":0,"rh_3_1":0,"rh_3_3":0,"rh_3_4":0,"rh_4_1":0,"rh_4_2":0,"rh_4_3":0,"rh_5_1":0,"rh_5_2":0,"rh_5_3":0,"rh_5_4":0,"rh_6_1":0,"rh_6_2":0,"rh_6_3":0,"rh_6_4":0,"rh_7_1":0,"rh_7_2":0,"rh_7_4":0,"rh_8_1":0,"rh_8_3":0,"rh_9_2":0,"rh_9_3":0,"rh_9_4":0,"rh_n1":0,"rh_n2":0}},"vex":{"ids":["ropewalker","slow_cut","short_list"],"of":{"rw_10_1":0,"rw_10_2":0,"rw_10_4":0,"rw_11_1":0,"rw_11_2":0,"rw_11_3":0,"rw_12_1":0,"rw_12_2":0,"rw_12_3":0,"rw_12_4":0,"rw_13_2":0,"rw_1_1":0,"rw_1_3":0,"rw_1_4":0,"rw_2_1":0,"rw_2_2":0,"rw_2_3":0,"rw_3_1":0,"rw_3_3":0,"rw_3_4":0,"rw_4_1":0,"rw_4_2":0,"rw_4_3":0,"rw_5_1":0,"rw_5_2":0,"rw_5_3":0,"rw_5_4":0,"rw_6_1":0,"rw_6_2":0,"rw_6_3":0,"rw_6_4":0,"rw_7_1":0,"rw_7_3":0,"rw_7_4":0,"rw_8_1":0,"rw_8_2":0,"rw_8_3":0,"rw_9_1":0,"rw_9_3":0,"rw_9_4":0,"rw_n1":0,"rw_n2":0,"sc_10_1":1,"sc_10_2":1,"sc_10_4":1,"sc_11_1":1,"sc_11_2":1,"sc_11_3":1,"sc_12_1":1,"sc_12_2":1,"sc_12_3":1,"sc_12_4":1,"sc_13_2":1,"sc_1_1":1,"sc_1_3":1,"sc_1_4":1,"sc_2_1":1,"sc_2_2":1,"sc_2_3":1,"sc_3_1":1,"sc_3_3":1,"sc_3_4":1,"sc_4_1":1,"sc_4_2":1,"sc_4_3":1,"sc_5_1":1,"sc_5_2":1,"sc_5_3":1,"sc_5_4":1,"sc_6_1":1,"sc_6_2":1,"sc_6_3":1,"sc_6_4":1,"sc_7_1":1,"sc_7_2":1,"sc_7_3":1,"sc_7_4":1,"sc_8_1":1,"sc_8_3":1,"sc_9_2":1,"sc_9_4":1,"sc_n1":1,"sc_n2":1,"sl_10_1":2,"sl_10_2":2,"sl_10_3":2,"sl_11_1":2,"sl_11_2":2,"sl_11_4":2,"sl_12_1":2,"sl_12_2":2,"sl_12_3":2,"sl_12_4":2,"sl_13_2":2,"sl_1_1":2,"sl_1_2":2,"sl_1_4":2,"sl_2_1":2,"sl_2_2":2,"sl_2_3":2,"sl_3_1":2,"sl_3_3":2,"sl_3_4":2,"sl_4_1":2,"sl_4_2":2,"sl_4_3":2,"sl_5_2":2,"sl_5_3":2,"sl_5_4":2,"sl_6_1":2,"sl_6_2":2,"sl_6_3":2,"sl_6_4":2,"sl_7_1":2,"sl_7_3":2,"sl_7_4":2,"sl_8_1":2,"sl_8_2":2,"sl_8_3":2,"sl_9_2":2,"sl_9_3":2,"sl_9_4":2,"sl_n1":2,"sl_n2":2,"sl_n3":2}},"vireo":{"ids":["listening_hall","dissonance","living_instrument"],"of":{"ds_10_1":1,"ds_10_3":1,"ds_10_4":1,"ds_11_1":1,"ds_11_2":1,"ds_11_4":1,"ds_12_1":1,"ds_12_2":1,"ds_12_3":1,"ds_12_4":1,"ds_13_2":1,"ds_1_1":1,"ds_1_3":1,"ds_1_4":1,"ds_2_1":1,"ds_2_2":1,"ds_2_3":1,"ds_3_1":1,"ds_3_4":1,"ds_4_1":1,"ds_4_2":1,"ds_4_4":1,"ds_5_1":1,"ds_5_2":1,"ds_5_3":1,"ds_5_4":1,"ds_6_1":1,"ds_6_2":1,"ds_6_3":1,"ds_6_4":1,"ds_7_1":1,"ds_7_2":1,"ds_7_4":1,"ds_8_1":1,"ds_8_3":1,"ds_8_4":1,"ds_9_1":1,"ds_9_2":1,"ds_9_3":1,"ds_n1":1,"ds_n2":1,"lh_10_1":0,"lh_10_3":0,"lh_10_4":0,"lh_11_1":0,"lh_11_2":0,"lh_11_4":0,"lh_12_1":0,"lh_12_2":0,"lh_12_3":0,"lh_12_4":0,"lh_13_2":0,"lh_1_1":0,"lh_1_3":0,"lh_2_1":0,"lh_2_2":0,"lh_2_3":0,"lh_3_1":0,"lh_3_3":0,"lh_3_4":0,"lh_4_1":0,"lh_4_2":0,"lh_4_4":0,"lh_5_1":0,"lh_5_2":0,"lh_5_3":0,"lh_5_4":0,"lh_6_1":0,"lh_6_2":0,"lh_6_3":0,"lh_7_1":0,"lh_7_2":0,"lh_7_4":0,"lh_8_1":0,"lh_8_3":0,"lh_8_4":0,"lh_9_1":0,"lh_9_2":0,"lh_9_3":0,"lh_n1":0,"lh_n2":0,"li_10_1":2,"li_10_3":2,"li_10_4":2,"li_11_1":2,"li_11_2":2,"li_11_4":2,"li_12_1":2,"li_12_2":2,"li_12_3":2,"li_12_4":2,"li_13_2":2,"li_1_1":2,"li_1_3":2,"li_1_4":2,"li_2_1":2,"li_2_2":2,"li_2_3":2,"li_3_1":2,"li_3_3":2,"li_3_4":2,"li_4_1":2,"li_4_2":2,"li_4_4":2,"li_5_1":2,"li_5_2":2,"li_5_3":2,"li_5_4":2,"li_6_1":2,"li_6_2":2,"li_6_3":2,"li_6_4":2,"li_7_1":2,"li_7_2":2,"li_7_4":2,"li_8_1":2,"li_8_3":2,"li_8_4":2,"li_9_1":2,"li_9_2":2,"li_9_3":2}}};
  const MECH={};
  MECH["absalie"]=(function(){const module={exports:{}};
/* ABSALIE - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 15: what Absalie added)
   Her real kit (the code, not the tooltip wording):
   - Abyssal Needle ('mrshred', green, cd 6, delivered as a shot): 150% of ability power x skill level, magic, to her target; then that enemy's magic resist is cut
     by o.shred (32%, a third of the skill curve on top, at most 45%) for o.dur (5 s): _mrShredPct / _mrShredT. Single target.
   - Gravity Knot ('gravknot', blue, cd 10, formed where she stands): every enemy whose CENTRE is within 4 m (o.radius) of HER is moved at once 60% of the way
     toward her, at most o.pull (2.2 m) (not an immovable one), slowed through ccApply (the control table's area slow: 3 s x the 30% cut = 2.1 s) and struck
     for 60% of ability power x level (magic). She stands in the back row, so the plain Knot catches only enemies that came to her.
   - Event Horizon ('eventhorizon', ultimate, player-aimed or the densest group): every enemy whose centre is within 7 m of its centre is caught and dragged
     toward it with the engine's own drag, which HAS a stopping distance (pullStop 6): it really moves them (unlike Astra's Collapsing Star). After the drag
     (1.2 s x BATTLE_PACE) it collapses: 190% x level to each caught enemy still alive, and their silence is WRITTEN STRAIGHT ON (1.05 s, no ccApply).
     Veyr's Abyssal Undertow runs the same code with a slow instead; every hook passes its own skill name.
   - Dark Convergence (passive): at the PRESS of an area ability (castKit: only Gravity Knot) she gets 4 x 3 energy x her passive's level, however many it
     will hit. Never for the Needle (one target), never for Event Horizon (the ultimate does not go through castKit).
   - A silence cancels a cast under way (castTick): that is how her talents "interrupt" and make a cast "fail"; the cooldown spent at the press stays spent.
   Page hooks used for her (doc 03 section 15): 'at' in the Knot and Event Horizon cases (where they form; marks 'gkC' / 'ehC' = what they catch, as the skill
   measures, centre to centre); 'skillTgt' in the Knot (its centre: Wide Knot); 'landPre' / 'land' around the collapse (its hits are 'eventhorizon' to the
   rows) and a direct 'ccHit' for each silence it writes; new: 'teamCc' (a control on a watched unit through ccApply) and 'nrgPre' / 'nrgIn' (energy a
   watched unit gains from a hit).
   Readings and capped or reworded tooltips: WIRING/11 - ABSALIE - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const NE='mrshred', GK='gravknot', EH='eventhorizon';
const IN_PT={team:'enemy',of:'pt',withinOpt:'radius'};                            // every enemy the skill catches where it forms, centre to centre as the skill measures
const GKC={team:'enemy',has:'gkC'}, EHC={team:'enemy',has:'ehC'};                 // what this Knot / this Event Horizon caught
const TNG={team:'enemy',has:'tng'}, TNG_O={team:'enemy',has:'tng',skip:'target'}; // Tangled enemies (the others)
const NEAR_O={team:'enemy',of:'target',n:1,skip:'target'};                        // the nearest other enemy to the target
const SIL={silencedT:1e-9};                                                       // silenced now
const VS_ALLY={srcTeam:'enemy',targetTeam:'ally'};                                // an enemy's hit on one of her allies (teamIn)
const MUFFLE=(on,k)=>({emit:'muffle',on,k});                                      // Muffled for k seconds (the always row writes it)
module.exports={
  hero:'absalie',
  casting:true,                         // rows ask which of her skills a hit comes from
  points:true,                          // rows read where the Knot and Event Horizon form (the 'at' hook)
  states:{
    thr:{unit:true,max:4,dur:P('thr.dur',8),gain:'thrGain'},                     // Threads on each enemy: all of them lapse 8 s after the last one
    tension:{max:{b:12,$:'tension.max'},dur:P('tension.dur',10)},                 // Tension: all of it lapses 10 s after the last gain
    word:{max:6,fade:{after:{b:8,$:'word.dur'},every:0.01,lose:99,unless:{selfHpAbove:{b:9,$:'word.hold'}}},gain:'wordGain'},   // Words: all fade 8 s after the last one (Hoarded Words: not above half HP)
    ehN:{}                                                                         // enemies this Event Horizon caught (Collapse, at most 5)
  },
  /* run for her whenever she has any mechanic talent: what her area skills catch, her silences as one event, Muffled as one state, the Knot's slow strength */
  always:[
    {on:'at',skill:GK,do:[{mark:'gkC',on:{team:'enemy'},clear:true},{mark:'gkC',on:IN_PT,dur:1}]},
    {on:'at',skill:EH,do:[{mark:'ehC',on:{team:'enemy'},clear:true},{mark:'ehC',on:IN_PT,dur:4}]},
    {on:'ccHit',if:{cc:['silencedT'],targetAlive:true},do:[{emit:'quiet'}]},                                   // every silence of hers that lands (ctx.amt = its seconds)
    {on:'muffle',do:[{mark:'muf',on:'target',dur:{flat:1,k:1},longest:true,ends:'mufEnd'},{window:'mufW',dur:{flat:1,k:1},longest:true}]},
    {on:'ccHit',if:{casting:GK,cc:['slow'],talent:false,p:'gk.slow'},do:[{slowMore:P('gk.slow',0),on:'target'}]},   // Leaning In / Close Knot: the Knot's own slow, stronger
    {on:'cast',skill:NE,do:[{window:'unw',end:true},{window:'eye',end:true},{window:'cn',end:true}]}           // the Needle's one-cast windows close with the cast
  ],
  talents:{
    /* ============================== THE EMPTY CHAIR ============================== */
    ec_1_1:[ {on:'hit',if:{casting:NE,targetAlive:true},do:[{ustack:'thr',on:'target',add:1}]},                // Fray: each Needle pulls a Thread (max 4, 8 s)
             {on:'out',ignoreMr:R(0.01),per:{ust:'thr'}} ],                                                     //   her hits ignore 1% of its magic resist per Thread
    ec_1_3:[ {on:'hit',if:{auto:true,targetHas:'hol',targetAlive:true},chance:R(0.06),do:[{ustack:'thr',on:'target',add:1}]} ],   // Fine Work
    ec_1_4:[ {on:'kit',skill:NE,opt:{mul:{more:R(0.04)}}} ],                                                    // Point of Nothing
    ec_2_1:[ {param:'thr.dur',add:R(1)} ],                                                                      // Loose Ends
    ec_2_2:[ {on:'hit',if:{casting:NE,targetAlive:true},do:[{mark:'hol',on:'target',dur:P('hol.dur',5),longest:true}]},   // Hollow: 5 s
             {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'hol',targetMin:{shield:1e-9}},more:R(0.04)},   //   its shield wears through 4% faster (hits on it deal 4% more while it has one)
             {on:'teamHeal',if:{unitHas:'hol'},less:R(0.02)} ],                                                 //   healing on it 2% weaker
    ec_n1:[  {on:'out',if:{casting:NE,targetMin:SIL},more:0.08},                                                // Pulled Word (LINK)
             {on:'quiet',req:'us_1_1',do:[{ustack:'thr',on:'target',add:1}]} ],                                 //   with Swallowed Word: each Word taken also pulls a Thread
    ec_3_1:[ {on:'kit',skill:NE,if:{targetUst:{thr:4}},opt:{mul:{more:0.6}},do:[{window:'unw',dur:99}]},       // Unwoven: at 4 Threads the next Needle 60% more
             {on:'hit',if:{casting:NE,window:'unw'},do:[{window:'unw',end:true},{ustack:'thr',on:'target',set:0},{emit:'unwoven'}]} ],   //   and the Threads clear
    ec_n2:[  {on:'in',if:{srcUst:{thr:1}},less:R(0.015)} ],                                                     // Coming Apart
    ec_3_4:[ {on:'kit',skill:NE,opt:{dur:{add:R(0.3)}}} ],                                                      // Long Shred
    ec_4_1:[ {stat:{move:R(-0.01)},per:{ust:'thr'},to:{team:'enemy',ust:{thr:1}},if:{window:'thrW'}},          // Pulled Thread: 1% slower per Thread
             {on:'thrGain',do:[{window:'thrW',dur:P('thr.dur',8),longest:true}]} ],                             //   (looked at only while a Thread can be down)
    ec_4_2:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'hol',targetMin:{shield:1e-9},hitMin:{pct:1,of:'tgtShield'}},   // Gutted Ward: a hit that breaks it
               do:[{after:0,do:[{dmg:{pct:R(0.10),of:'apow'},on:'target',tag:'gw'}]}]} ],
    ec_5_2:[ {on:'hit',if:{casting:NE},do:[{dmg:{pct:0.4,of:'hit'},on:NEAR_O,tag:'n2'}]} ],                      // Second Needle (PICK ONE)
    ec_5_3:[ {on:'kit',skill:NE,if:{none:{team:'enemy',of:'target',within:3,skip:'target'}},opt:{shred:{add:0.08}}} ],   // Long Needle (PICK ONE)
    ec_5_1:[ {on:'death',if:{who:'enemy',unitHas:'hol'},do:[{zone:'ep',at:'unit',radius:P('ep.r',2),dur:P('ep.dur',6),catch:'epCatch',uses:P('ep.n',1)}]},   // Empty Place
             {on:'epCatch',do:[{pull:'target',to:'pt',secs:0.3},{dmg:{pct:R(0.08),of:'apow'},on:'target',tag:'ep'}]} ],   //   the next enemy within 2 m: into the middle, 8% of her ability power
    ec_2_4:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                             // Quick Needle
    ec_5_4:[ {on:'cd',less:R(0.01)} ],                                                                          // Patient Hands
    ec_6_1:[ {param:'ep.r',add:R(0.3)} ],                                                                       // Wider Gap
    ec_6_2:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'hol'},more:R(0.015)} ],              // Nothing Left
    ec_7_1:[ {param:'ep.n',add:1} ],                                                                            // Hungry Gap
    ec_7_2:[ {on:'kit',skill:NE,if:{targetHas:'hol'},do:[{window:'eye',dur:99}]},                              // Needle's Eye: against an enemy already Hollow
             {on:'hit',if:{casting:NE,window:'eye'},do:[{window:'eye',end:true},{mark:'hol',on:NEAR_O,dur:P('hol.dur',5),longest:true},{dmg:{pct:0.5,of:'hit'},on:NEAR_O,tag:'eye'}]} ],
    ec_9_3:[ {on:'out',if:{auto:false,targetHpBelow:0.4},more:R(0.02)} ],                                       // No One Home
    ec_7_4:[ {on:'kit',skill:NE,opt:{shred:{add:R(0.01)}}} ],                                                   // Empty Hands
    ec_8_2:[ {param:'hol.dur',add:R(0.5)} ],                                                                    // Set Place
    ec_8_3:[ {on:'out',if:{casting:NE},ignoreMr:R(0.01)} ],                                                     // Fine Point
    ec_8_4:[ {on:'in',if:{srcHas:'hol'},less:R(0.03)} ],                                                        // Cold Plate
    ec_9_1:[ {on:'out',if:{auto:true},more:R(0.02),per:{ust:'thr'}} ],                                          // Frayed Edge
    ec_9_4:[ {on:'in',once:'wave',if:{hitMin:{pct:0.30,of:'maxHp'}},mul:0.5} ],                                 // Kept Chair
    ec_10_1:[ {on:'epCatch',do:[{mark:'hol',on:'target',dur:R(1.5),longest:true}]} ],                           // Unmade Bed
    ec_10_2:[ {on:'out',if:{casting:GK,targetHas:'hol'},more:R(0.04)} ],                                        // Narrow Gap
    ec_10_3:[ {stat:{nrg:R(0.02)}} ],                                                                           // Distant Stare
    ec_11_2:[ {on:'out',if:{casting:NE,targetUst:{thr:4}},more:R(0.08)} ],                                      // Last Stitch
    ec_11_3:[ {on:'out',if:{casting:EH,targetHas:'hol'},more:R(0.03)} ],                                        // Pale Loom
    ec_11_4:[ {on:'in',if:{auto:true},less:R(0.03)} ],                                                          // Void Cloak
    ec_12_1:[ {on:'unwoven',do:[{energy:R(4)}]} ],                                                              // Unravelling: 4 Threads cut, 1 energy each per rank
    ec_12_2:[ {param:'ep.dur',add:R(1)} ],                                                                      // Long Absence
    ec_12_3:[ {on:'out',if:{casting:NE,targetIs:{team:'enemy',order:'high:maxHp',n:1}},more:R(0.03)} ],         // Hollow Crown
    ec_13_3:[ {on:'land',skill:EH,do:[{emit:'chair',on:{team:'enemy',has:'ehC',order:'most:thr',n:1}}]},        // The Empty Chair (SIGNATURE): the caught enemy with the most Threads
              {on:'chair',do:[{stun:2,on:'target',if:{targetIs:{team:'enemy',boss:false}}},{stun:1,on:'target',if:{targetIs:{team:'enemy',boss:true}}},
                {mark:'chair',on:'target',dur:2.1,while:'stunned',ends:'chairEnd'}]},                           //   set aside: stunned 2 s (1 s on a boss)
              {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'chair'},more:0.15},                 //   her team deals 15% more to it
              {on:'teamHeal',if:{unitHas:'chair'},mul:0},                                                       //   it cannot be healed
              {on:'chairEnd',do:[{mark:'hol',on:'target',dur:P('hol.dur',5),longest:true},{ustack:'thr',on:'target',set:4},{emit:'thrGain'},{mark:'chairN',on:'target',dur:30}]},   //   back Hollow with 4 Threads
              {on:'kit',skill:NE,unless:'ec_3_1',if:{targetHas:'chairN'},opt:{mul:{more:0.6}},do:[{window:'cn',dur:99}]},   //   her next Needle on it (Unwoven does this itself)
              {on:'hit',unless:'ec_3_1',if:{casting:NE,window:'cn'},do:[{window:'cn',end:true},{mark:'chairN',on:'target',clear:true},{later:[{ustack:'thr',on:'target',set:0}]}]} ],   //   (after this Needle's own Thread: all cut)

    /* ============================== THE GREAT KNOT ============================== */
    gk_1_1:[ {on:'at',skill:GK,do:[{mark:'tng',on:IN_PT,dur:P('tng.dur',3),longest:true},{window:'tngW',dur:P('tng.dur',3),longest:true}]},   // Tangle: 3 s
             {on:'hit',if:{targetHas:'tng'},do:[{dmg:{pct:R(0.04),of:'hit'},on:TNG_O,tag:'tng'}]} ],            //   4% of her hit on one to each of the others
    gk_2_4:[ {on:'kit',skill:GK,opt:{pull:{addM:R(0.2)}}}, {param:'gk.half',add:R(0.1)} ],                      // Deeper Pull (Slipknot pulls half of it)
    gk_1_4:[ {on:'kit',skill:GK,opt:{mul:{more:R(0.05)}}} ],                                                    // Tight Knot
    gk_2_1:[ {param:'tng.dur',add:R(0.5)} ],                                                                    // Snarl
    gk_2_3:[ {on:'at',do:[{stack:'tension',add:{units:IN_PT}}]},                                               // Tension: each enemy the Knot or Event Horizon catches
             {stat:{apow:R(0.003)},per:'tension'} ],
    gk_3_1:[ {on:'at',skill:EH,if:{some:{team:'enemy',has:'tng',of:'pt',withinOpt:'radius'}},do:[{pull:{team:'enemy',has:'tng',lacks:'ehC'},to:'pt',secs:{opt:'pull',d:1.2}}]},   // Knotwork
             {on:'epCatch',if:{targetHas:'tng'},do:[{pull:TNG_O,to:'pt',secs:0.3}]} ],
    gk_3_2:[ {param:'gk.slow',add:R(0.03)} ],                                                                   // Leaning In (the always row)
    gk_3_3:[ {param:'tension.dur',add:R(1)} ],                                                                  // Taut
    gk_3_4:[ {on:'ccIn',less:R(0.04)} ],                                                                        // Steady Mind
    gk_4_2:[ {on:'cd',skill:'blue',add:R(-0.2)} ],                                                              // Hard Pull
    gk_4_3:[ {on:'kit',skill:GK,if:{stackMin:{tension:12}},do:[{stack:'tension',spend:'all'},{window:'snap',dur:99}]},   // Snap: at 12 Tension
             {on:'at',skill:GK,if:{window:'snap'},do:[{window:'snap',end:true},{stun:0.8,on:IN_PT}]} ],
    gk_4_4:[ {on:'kit',skill:GK,opt:{radius:{addM:R(0.2)}}} ],                                                  // Long Reach
    gk_5_1:[ {stat:{aspd:R(-0.015)},to:TNG,if:{window:'tngW'}} ],                                               // Choke Point
    gk_11_4:[ {on:'tick',if:{selfMin:{pullT:1e-9}},do:[{damp:'pullSpeed',by:R(0.15),on:'self'}]} ],             // Weighted Robe: a drag on her moves her 15% less far
    gk_8_4:[ {on:'kit',skill:EH,opt:{silence:{add:R(0.1),ccRaw:true}}} ],                                       // Event Line
    gk_6_1:[ {on:'hit',if:{targetHas:'tng',atLeast:{n:4,of:TNG}},do:[{dmg:{pct:R(0.02),of:'hit'},on:TNG_O,tag:'tng2'}]} ],   // Shared Weight
    gk_6_2:[ {on:'at',skill:GK,if:{selfPass:'convergence'},do:[{emit:'clE',on:Object.assign({skipN:2},IN_PT)}]}, {on:'clE',do:[{energy:R(1)}]} ],   // Converging Lines
    gk_6_4:[ {on:'at',skill:EH,do:[{stack:'ehN',set:{units:IN_PT,max:5}}]}, {on:'out',if:{casting:EH},more:R(0.03),per:'ehN'} ],   // Collapse (up to 5)
    gk_7_1:[ {on:'out',if:{auto:false},more:R(0.01),per:{units:{team:'enemy',of:'target',within:3,skip:'target'},max:5}} ],   // Crowded Room (up to 5)
    gk_7_2:[ {on:'ccHit',if:{casting:GK,cc:['slow'],talent:false},do:[{mark:'gks',on:'target',dur:{flat:0.1,pct:1,of:'hit'},while:'slow',ends:'gkSlowEnd'}]},   // Slipknot
             {on:'gkSlowEnd',do:[{pull:'target',to:'pt:gravknot',m:{b:1.1,$:'gk.half'},secs:0.3}]} ],
    gk_7_4:[ {on:'kit',skill:EH,opt:{pull:{add:0.4},radius:{addM:1}}} ],                                        // Deep Gravity
    gk_5_2:[ {on:'skillTgt',skill:GK,do:[{retarget:'densest'}]} ],                                              // Wide Knot (PICK ONE): on the densest group
    gk_8_2:[ {stat:{aspd:R(0.002)},per:'tension'} ],                                                            // Coiled
    gk_8_3:[ {on:'out',if:{auto:false,targetMin:{slow:1e-9}},more:R(0.02)} ],                                   // Dense Weave
    gk_5_3:[ {param:'gk.slow',add:0.20}, {on:'cast',skill:GK,do:[{pull:GKC,to:'self',secs:0.3}]} ],             // Close Knot (PICK ONE): all the way in, slowed 20% harder
    gk_9_1:[ {on:'teamIn',if:{targetHas:'tng',srcIs:'ally'},more:R(0.01)} ],                                    // Pulled Tight
    gk_9_2:[ {param:'tension.max',add:6}, {on:'kit',skill:EH,opt:{mul:{more:0.005,per:{stack:'tension',over:12}}}} ],   // Overwound
    gk_9_3:[ {on:'cd',less:R(0.01)} ],                                                                          // Dark Pull
    gk_10_1:[ {on:'death',if:{who:'enemy',unitHas:'tng'},do:[{pull:TNG,to:'unit',m:1.5,secs:0.3}]} ],           // Knot Breaker
    gk_10_3:[ {on:'kit',skill:EH,opt:{mul:{more:R(0.02)}}} ],                                                   // Centre of Mass
    gk_10_4:[ {on:'in',if:{srcMin:{slow:1e-9}},less:R(0.015)} ],                                                // Gravity Well
    gk_11_1:[ {on:'in',if:{srcHas:'tng'},less:R(0.01)}, {on:'teamIn',if:Object.assign({srcHas:'tng'},VS_ALLY),less:R(0.01)} ],   // Bound Together
    gk_11_2:[ {stat:{nrg:R(0.02)}} ],                                                                           // Massing Dark
    gk_12_1:[ {on:'teamCc',if:{cc:['stunned'],unitHas:'tng',srcTeam:'ally'},chance:R(0.10),do:[{emit:'sfall'}]},   // Shared Fall: a stun from her team (through the engine)
              {on:'ccHit',if:{cc:['stunned'],targetHas:'tng',targetLacks:'sfX'},chance:R(0.10),do:[{emit:'sfall'}]},   //   or a stun of her own talents
              {on:'sfall',do:[{mark:'sfX',on:TNG,dur:0.1},{stun:{pct:1,of:'hit'},on:TNG_O,asIs:true}]} ],
    gk_12_2:[ {on:'kit',skill:GK,opt:{mul:{more:R(0.03)}}} ],                                                   // Pull of Home
    gk_12_4:[ {on:'in',less:R(0.01),per:{units:TNG,max:5}} ],                                                   // Thread Cloak (up to 5)
    gk_13_2:[ {on:'land',skill:EH,do:[{mark:'tng',on:EHC,dur:6,longest:true},{window:'tngW',dur:6,longest:true},   // The Great Knot (SIGNATURE): as it collapses
                {mark:'gkm',on:EHC,dur:6,spot:'pt:eventhorizon'},{window:'gk',dur:6},{stack:'tension',set:'max'}]},
              {on:'tick',if:{window:'gk'},do:[{pull:{team:'enemy',has:'gkm',away:{mark:'gkm',m:3}},to:{spot:'gkm'},m:1,secs:0.2}]},   //   one that strays more than 3 m is dragged back
              {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'gkm'},do:[{emit:'gkShare',amt:{pct:0.25,of:'hit',split:{units:{team:'enemy',has:'gkm',skip:'target'}}}}]},
              {on:'gkShare',do:[{dmg:{pct:1,of:'hit'},on:{team:'enemy',has:'gkm',skip:'target'},tag:'gk'}]} ],   //   25% of a hit on one, split between the others

    /* ============================== THE UNSAID ============================== */
    us_1_1:[ {on:'quiet',do:[{stack:'word',add:1}]}, {stat:{apow:R(0.005)},per:'word'} ],                      // Swallowed Word
    us_11_4:[ {on:'in',if:{auto:false},less:R(0.02)} ],                                                         // Mute Cloak
    us_1_4:[ {on:'kit',skill:EH,opt:{silence:{add:R(0.1),ccRaw:true}}} ],                                       // Thread of Quiet
    us_2_1:[ {param:'word.dur',add:R(1)} ],                                                                     // Long Silence
    us_2_2:[ {on:'quiet',do:[{mark:'sil',on:'target',dur:{flat:0.1,pct:1,of:'hit'},while:'silencedT',ends:'silEnd'}]},   // Afterquiet: when her silence ends
             {on:'silEnd',do:[MUFFLE('target',P('muf.dur',3))]},                                               //   Muffled 3 s
             {on:'in',if:{auto:false,srcHas:'muf'},less:R(0.03)}, {on:'teamIn',if:Object.assign({auto:false,srcHas:'muf'},VS_ALLY),less:R(0.03)} ],
    us_3_1:[ {on:'kit',if:{casting:[NE,GK],stackMin:{word:6}},do:[{stack:'word',spend:'all'},{energy:15}]} ],   // Full Mouth
    us_3_2:[ {on:'in',if:{auto:true,srcHas:'muf'},less:R(0.02)}, {on:'teamIn',if:Object.assign({auto:true,srcHas:'muf'},VS_ALLY),less:R(0.02)} ],   // Dull Edge
    us_n1:[  {on:'wave',do:[MUFFLE({team:'enemy',order:'high:apow',n:1},R(1))]} ],                              // First to Speak
    us_4_1:[ {on:'in',less:R(0.003),per:'word'} ],                                                              // Stolen Breath
    us_4_2:[ {on:'hit',if:{casting:NE,targetCast:true,targetAlive:true},do:[{silence:0.8,on:'target'}]} ],      // Cut Short
    us_4_4:[ {on:'out',if:{casting:NE,targetHas:'muf'},more:R(0.03)} ],                                         // Needle Hush
    us_5_1:[ {on:'hit',if:{auto:false,targetMin:SIL,selfPass:'convergence'},icd:0.5,do:[{energy:R(2)}]} ],      // Echo Gap (once per spell)
    us_5_2:[ {on:'at',skill:GK,do:[{silence:0.5,on:IN_PT}]} ],                                                  // Mute Knot (PICK ONE)
    us_5_3:[ {on:'at',skill:GK,do:[MUFFLE(IN_PT,3)]} ],                                                         // Deaf Knot (PICK ONE)
    us_5_4:[ {on:'cd',less:R(0.01)} ],                                                                          // Still Loom
    us_6_1:[ {on:'quiet',req:'us_1_1',if:{targetMore:'apow'},do:[{stack:'word',add:1}]}, {param:'word.dur',add:R(1)} ],   // Swallowed Shout
    us_6_3:[ {stat:{move:R(-0.04)},to:{team:'enemy',has:'muf'},if:{window:'mufW'}} ],                          // Muffled Steps
    us_6_4:[ {stat:{nrg:R(0.015)}} ],                                                                           // Unspent
    us_7_1:[ {on:'wordGain',do:[{heal:{pct:R(0.01),of:'maxHp',k:1},on:'self'}]} ],                              // Gap Feeding
    us_7_2:[ {param:'muf.dur',add:R(0.4)} ],                                                                    // Lingering Hush
    us_7_3:[ {on:'teamNrg',if:{unitHas:'muf'},mul:0} ],                                                         // Closed Door
    us_8_2:[ {stat:{cdRate:R(-0.03)},to:{team:'enemy',has:'muf'},if:{window:'mufW'}} ],                        // Tongue-Tied
    us_8_3:[ {on:'in',if:{srcHas:'muf'},less:R(0.02)} ],                                                        // Quiet Ward
    us_9_1:[ {on:'out',if:{targetMin:SIL},more:R(0.02)} ],                                                      // Wordless
    us_9_2:[ {on:'mufEnd',if:{targetLacks:'ss12'},do:[{mark:'ss12',on:'target',dur:12},{silence:0.5,on:'target'}]} ],   // Second Silence
    us_9_4:[ {on:'kit',skill:EH,opt:{mul:{more:R(0.02)}}} ],                                                    // Mouth of the Void
    us_10_1:[ {param:'word.hold',add:-8.5} ],                                                                   // Hoarded Words: they do not fade above 50% HP
    us_10_3:[ {on:'ccHit',if:{casting:EH,cc:['silencedT'],talent:false},do:[{energy:R(1)}]} ],                  // Breath Held
    us_10_4:[ {on:'cd',skill:'green',add:R(-0.1)} ],                                                            // Starved Gap
    us_11_1:[ {on:'in',if:{srcWithin:4},less:R(0.003),per:'word'}, {on:'teamIn',if:Object.assign({srcWithin:4},VS_ALLY),less:R(0.003),per:'word'} ],   // Speechless
    us_11_3:[ {on:'ccOut',if:{casting:EH,cc:['silencedT'],targetCast:true},add:R(0.3)} ],                       // The Long Pause
    us_12_1:[ {on:'tick',edge:true,if:{selfHpBelow:0.30},do:[{stack:'word',spend:'all',then:[{heal:{pct:R(0.02),of:'maxHp',x:'spent'},on:'self'}]}]} ],   // Spent Words
    us_12_3:[ {on:'in',if:{srcMin:SIL},less:R(0.015)}, {on:'teamIn',if:Object.assign({srcMin:SIL},VS_ALLY),less:R(0.015)} ],   // Nothing to Say
    us_12_4:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                             // Quiet Hands
    us_13_3:[ {on:'land',skill:EH,do:[{mark:'nw',on:{team:'enemy'},dur:6},{window:'nw',dur:6}]},                // The Next Word (SIGNATURE): 6 s after it collapses
              {on:'tick',if:{window:'nw'},do:[{emit:'nwFail',on:{team:'enemy',has:'nw',cast:'spell'}}]},        //   the first ability each enemy starts
              {on:'nwFail',do:[{mark:'nw',on:'target',clear:true},{timer:'silencedT',min:0.1,on:'target'},     //   fails (a silence cancels it; its cooldown stays spent)
                {stack:'word',add:1},{energy:5},MUFFLE('target',P('muf.dur',3))]} ]
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/11 - ABSALIE - talent decisions.md) */
  ruling:{}
};

return module.exports;})();
  MECH["aldren"]=(function(){const module={exports:{}};
/* ALDREN - what his learned talents do in a fight (the mechanics; his 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 16: what Aldren added)
   His real kit (the code, not the tooltip wording):
   - Ink Spirit ('summonwarriors', green, cd 11): calls o.n (1) Lesser Ink Spirit ('ink spirit') for o.dur (16 s) beside him (summonUnit: 55% of his max HP and
     attack x the skill level's share, +80 armor / MR). It only basic-attacks. At most 3 Lesser Ink Spirits stand at once (SUMMON_CAPS); a call over the cap fails.
   - Chapter Rewrite ('chapterrewrite', blue, cd 9): 110% of ability power (magic) to his target, then for o.dur (6 s) its attack is cut by o.pct (30%) and its armor
     and magic resist by o.shred (25%); the "reversal" ENDS every buff on it at once (damage, haste, the damage-reduction slot, a crit buff, its heals over time) and
     burns its shield: a hit of shield x o.shieldBurn (1) true damage, which the shield it burns soaks up, then the shield is gone.
   - Living Pages (passive): every Green or Blue PRESS (castKit) writes a page (he holds at most 3); the next swing spends one for a magic hit of 60% of that
     swing's damage x his passive level, dealt at the swing (not a basic attack: auto is false). Final Volume writes none (the ultimate does not go through castKit).
   - Final Volume (ultimate, 'summonshaman'): calls one Elder Ink Horror ('ink horror', at most 1) for 22 s. The Horror basic-attacks and casts Ink Spin
     (a 'nova' around itself, every 6 s). Its hits are its own (src = the Horror), so his rows see them through the summon hooks.
   Page hooks used for him (doc 03 section 16): new 'summon' (summonUnit), 'sOut' / 'sHit' (_dealDamageCore), 'sGone' (a summon's time running out), 'sCc' (ccApply),
   'pagePre' / 'page' (the swing's page block), 'pageW0' / 'pageW' (the page written at castKit); hits on his summons and their deaths reach him through his watch.
   Readings and capped or reworded tooltips: WIRING/12 - ALDREN - talent decisions.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const IS='summonwarriors', CR='chapterrewrite', FV='summonshaman', SP='ink spirit', HO='ink horror';
const MINE={team:'ally',mine:true}, HORROR={team:'ally',mine:HO};                // his summons (all of them / the Horror)
const NOTES={stack:['fn','fk']};                                                 // Field Notes: the written ones and his Field Kit ones
const RW={team:'enemy',has:'rw'};                                                // rewritten enemies (under the rewrite's stat cut)
const STRONG3={team:'enemy',order:'strong',n:3};                                 // the three strongest enemies (the higher of attack and ability power)
const CE_AREA={team:'enemy',of:'target',within:P('ce.r',2),skip:'target'};       // a Chapter's End: every other enemy within 2 m of the page's target
const BLOT=(on)=>[{mark:'blot',on,dur:P('blot.dur',3),longest:true},{window:'blotW',dur:P('blot.dur',3),longest:true}];
const PAGE_ADD={field:'_pages',add:1,max:P('pg.cap',3)};                         // one more Living Page, never more than he can hold
const role=x=>(x&&x.t&&x.t.role)||'?';
module.exports={
  hero:'aldren',
  casting:true,                         // rows ask which of his skills a hit comes from (and 'page': a Living Page hit)
  summons:true,                         // his summons carry his rows (the summon hook)
  pages:true,                           // rows ask "is this hit a Living Page" (the two page hooks)
  states:{
    fn:{max:10},                                                                   // Field Notes written (max 10, kept for the fight)
    fk:{wave:'reset'},                                                             // Field Kit's notes (each wave; not counted toward the 10)
    bm:{max:1},                                                                    // a Bookmarked page waiting for his next Ink Spirit
    pc:{max:3},                                                                    // pages spent toward the next Chapter
    rev:{unit:true,max:3,dur:P('rev.dur',10),gain:'revGain'},                      // Revisions on each enemy: all lapse 10 s after the last one
    im:{unit:true,max:10,dur:3}                                                    // Ink Mastery's attack cut on each enemy (each Horror attack; all lapse 3 s after the last)
  },
  /* run for him whenever he has any mechanic talent: what a rewrite reverses (read before the skill ends it), who is rewritten, the page windows */
  always:[
    {on:'kit',skill:CR,do:[{fn:'rwSnap'}]},
    {on:'kit',skill:CR,if:{p:'burn'},opt:{shieldBurn:{set:P('burn',1)}}},                                         // Burnt Pages / Burnt Shield: the shield burn, larger
    {on:'kit',skill:CR,req:'rw_n1',if:{targetUst:{rev:1}},do:[{window:'fub',dur:99}]},                            // Filed Under Beasts: it ALREADY carries a Revision
    {on:'cast',skill:CR,do:[{mark:'rw',on:'target',dur:{opt:'dur',d:6},longest:true},{window:'rwW',dur:{opt:'dur',d:6},longest:true},{mark:'rw10',on:'target',dur:10}]},
    {on:'pagePre',do:[{window:'lb2',end:true},{window:'ce',end:true},{window:'ibt',end:true}]},
    {on:'pagePre',req:'lb_5_2',if:{selfMin:{_pages:2},noWindow:'open'},do:[{field:'_pages',add:-1},{window:'lb2',dur:1}]},   // Loose Binding: two pages at once
    {on:'pagePre',req:'lb_1_1',if:{any:[{stackMin:{pc:2}},{stackMin:{pc:1},window:'lb2'}]},do:[{window:'ce',dur:1}]},          // this page hit ends a Chapter
    {on:'pageW',if:{any:[{p:'pg.cap'},{p:'pg.n'}]},do:[{field:'_pages',set:{flat:P('pg.n',1),pct:1,of:'was'},max:P('pg.cap',3)}]}   // Written Twice / Thick Volume / Tight Binding
  ],
  talents:{
    /* ============================== THE BESTIARY ============================== */
    be_1_1:[ {on:'sHit',if:{targetTeam:'enemy'},do:[{mark:'sh',on:'target'}]},                                   // Field Notes: an enemy his summons have hit
             {on:'death',if:{who:'enemy',unitHas:'sh',targetLacks:'noted'},do:[{fn:'note'}]},   //   dies: a Field Note on it (max 10)
             {stat:{atk:R(0.004)},per:NOTES,to:MINE,if:{mine:true}} ],                                           //   each: his summons 0.4% more attack
    be_2_3:[ {on:'sGone',if:{unitKey:SP,unitExtra:false},do:[{mark:'bmT',on:'holder:bmT',clear:true},{stack:'bm',set:1},{mark:'bmT',on:'target',unique:true}]},   // Bookmark
             {on:'summon',if:{unitKey:SP,unitExtra:false,stackMin:{bm:1}},do:[{stack:'bm',set:0},{mark:'bmk',on:'unit',dur:4},{shield:{pct:R(0.05),of:'tgtMaxHp'},on:'unit',dur:99}]} ],
    be_2_1:[ {stat:{aspd:R(0.003)},per:NOTES,to:MINE,if:{mine:true}} ],                                         // Close Study
    be_3_3:[ {on:'summon',if:{unitHas:'bmk'},do:[{buff:'haste',x:R(0.03),dur:4,on:'unit'}]} ],                  // Dog-Eared
    be_3_1:[ {on:'noteW',every:5,do:[{field:'_summonT',add:2,on:MINE}]} ],                                      // Second Edition
    be_4_2:[ {on:'kit',skill:IS,opt:{dur:{add:R(0.6)}}} ],                                                      // Long Chapter
    be_4_3:[ {on:'summon',if:{unitHas:'bmk'},do:[{place:'unit',near:'holder:bmT'}]} ],                         // Marked Page
    be_n1:[  {on:'sCcIn',if:{cc:['stunned','slow']},less:R(0.06)} ],                                            // Sturdy Stitching (the game has no root)
    be_4_1:[ {on:'sOut',if:{targetTeam:'enemy',fn:'noted'},more:R(0.02)} ],                                     // Taxonomy
    be_5_2:[ {on:'kit',skill:IS,opt:{n:{set:2}}},                                                               // Pack Entry (PICK ONE): two Lesser Ink Spirits
             {on:'summon',if:{unitKey:SP,unitExtra:false},do:[{unitStat:{hp:-0.4,atk:-0.4,apow:-0.4},on:'unit'}]} ],   //   each with 60% of the stats
    be_1_2:[ {on:'cast',do:[{window:'pen',dur:3}]}, {on:'sOut',if:{window:'pen'},more:R(0.03)} ],               // Steady Pen
    be_5_3:[ {on:'summon',if:{unitKey:SP,unitExtra:false},do:[{unitStat:{hp:0.3,atk:0.3},on:'unit'}]} ],       // Single Entry (PICK ONE)
    be_5_1:[ {on:'teamIn',if:{targetMine:true,srcTeam:'enemy'},less:R(0.015)} ],                                // Ink Hide
    be_2_4:[ {on:'summon',if:{unitKey:SP},do:[{unitStat:{move:R(0.05)},on:'unit'}]} ],                         // Hunting Ink
    be_1_4:[ {on:'summon',if:{unitKey:SP},do:[{unitStat:{hp:R(0.04)},on:'unit'}]} ],                           // True Likeness
    be_6_1:[ {on:'sOut',if:{srcKey:SP},ignoreArmor:R(0.04)} ],                                                  // Sketched Fangs
    be_6_2:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                             // Read Aloud
    be_7_1:[ {stat:{apow:R(0.002)},per:NOTES} ],                                                                // Index of Beasts
    be_7_2:[ {on:'death',if:{unitMine:SP},do:[{dmg:{pct:0.4,of:'apow'},on:{team:'enemy',of:'unit',within:2},tag:'foot'}]} ],   // Footnoted: a spirit KILLED bursts
    be_7_3:[ {on:'summon',if:{unitKey:HO},do:[{unitStat:{hp:R(0.02)},on:'unit'}]} ],                           // Heavy Tome
    be_8_1:[ {on:'sOut',if:{targetTeam:'enemy',targetHpAbove:0.7},more:R(0.05)} ],                              // Nothing Gentler
    be_8_3:[ {on:'sOut',if:{srcKey:HO,auto:false},more:R(0.03)} ],                                              // Ink Spin Weight (the Horror's only non-basic hit is Ink Spin)
    be_8_4:[ {on:'cd',less:R(0.015)} ],                                                                         // Margin Sketch
    be_9_2:[ {on:'summon',do:[{unitStat:{hp:R(0.015)},on:'unit'}]} ],                                           // Wide Margins
    be_9_3:[ {on:'summon',if:{unitKey:HO},do:[{place:'unit',near:{team:'ally',mine:SP,n:1}}]},                 // Abridged: the Horror at a spirit's side
             {stat:{atk:{rk:'be_1_1',r:0.004}},per:NOTES,to:HORROR,if:{mine:HO}},                               //   and its Field Notes bonus twice
             {stat:{aspd:{rk:'be_2_1',r:0.003}},per:NOTES,to:HORROR,if:{mine:HO}},
             {stat:{atk:{rk:'be_12_1',r:0.001}},per:NOTES,to:HORROR,if:{mine:HO}} ],
    be_10_1:[ {on:'teamLethal',if:{unitMine:true,unitHas:'ccl'},do:[{atOne:'unit'}]},                           // Close Call: held at 1 HP for 1.5 s
              {on:'teamLethal',if:{unitMine:true},once:'wave',do:[{atOne:'unit'},{mark:'ccl',on:'unit',dur:1.5}]} ],
    be_10_2:[ {on:'kit',skill:FV,opt:{dur:{add:R(0.4)}}} ],                                                     // Longest Entry
    be_10_4:[ {on:'in',if:{mine:true},less:R(0.015)} ],                                                         // Back Shelf
    be_11_1:[ {on:'wave',do:[{stack:'fk',set:R(1)}]} ],                                                         // Field Kit
    be_11_2:[ {on:'sKill',do:[{energy:R(2)}]} ],                                                                // Callback
    be_11_3:[ {on:'death',if:{unitMine:true},do:[{shield:{pct:R(0.03),of:'maxHp'},on:'self',dur:4,mode:'max'}]} ],   // Old Bindings (the larger shield stays)
    be_12_1:[ {stat:{atk:R(0.001)},per:NOTES,to:MINE,if:{mine:true}} ],                                         // Addendum
    be_12_2:[ {on:'sOut',more:R(0.02)} ],                                                                       // Full Bestiary
    be_12_4:[ {stat:{nrg:R(0.02)}} ],                                                                           // Reading Light
    be_13_2:[ {on:'summon',if:{unitKey:HO},do:[{fn:'wholeBook'}]},                                              // The Whole Book (SIGNATURE)
              {on:'death',if:{unitMine:HO},do:[{fn:'wbEnd'}]}, {on:'sGone',if:{unitKey:HO},do:[{fn:'wbEnd'}]},
              {on:'teamIn',if:{targetMine:true,srcTeam:'enemy',mine:HO},less:0.2} ],

    /* ============================== THE REWRITE ============================== */
    rw_1_1:[ {on:'kit',skill:CR,if:{targetHas:'rw10'},do:[{ustack:'rev',on:'target',add:1}]},                  // Revision: rewritten again within 10 s
             {on:'kit',skill:CR,opt:{pct:{more:R(0.02),per:{ust:'rev'}},shred:{more:R(0.02),per:{ust:'rev'}}}} ],   //   each Revision: the cuts 2% deeper per rank
    rw_2_4:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                              // Editor's Eye
    rw_1_4:[ {on:'cast',skill:CR,if:{fn:'reversed'},do:[{shield:{pct:R(0.02),of:'maxHp'},on:'self',dur:4}]} ],  // Hard Cover (once a rewrite)
    rw_2_1:[ {param:'rev.dur',add:R(1)} ],                                                                      // Redraft
    rw_2_2:[ {param:'pt.k',add:R(0.1)}, {on:'cast',skill:CR,do:[{fn:'rwGive'}]} ],                              // Plot Twist
    rw_3_1:[ {on:'cast',skill:CR,if:{targetUst:{rev:3},targetAlive:true},do:[{silence:1,on:'target'}]} ],       // Final Cut
    rw_3_2:[ {on:'twist',do:[{heal:{pct:R(0.015),of:'tgtMaxHp'},on:'target'}]} ],                               // Twist Ending
    rw_n2:[  {stat:{mr:R(-0.02)},to:RW,if:{window:'rwW'}} ],                                                    // Thin Paper
    rw_4_1:[ {on:'teamIn',if:{srcHas:'rw',targetTeam:'ally'},less:R(0.01)} ],                                   // Red Lines
    rw_n1:[  {on:'kit',skill:CR,if:{window:'fub'},opt:{mul:{more:0.10}}}, {on:'cast',skill:CR,do:[{window:'fub',end:true}]},   // Filed Under Beasts (LINK)
             {on:'revGain',req:'be_1_1',if:{targetUst:{rev:3},targetLacks:'fub3'},do:[{mark:'fub3',on:'target'},{fn:'note'}]} ],
    rw_4_3:[ {on:'kit',skill:CR,opt:{dur:{add:R(0.5)}}} ],                                                      // Long Rewrite
    rw_4_4:[ {param:'burn',add:R(0.10)} ],                                                                      // Burnt Pages (the always row)
    rw_5_1:[ {on:'cd',less:R(0.015)} ],                                                                         // Strict Editor
    rw_5_2:[ {on:'kit',skill:CR,do:[{strip:1,on:'target'}]}, {on:'cast',skill:CR,do:[{fn:'rwSteal'}]} ],        // Stolen Shield (PICK ONE)
    rw_5_3:[ {param:'burn',add:0.5}, {on:'cast',skill:CR,do:[{fn:'rwSpread'}]} ],                               // Burnt Shield (PICK ONE)
    rw_5_4:[ {on:'kit',skill:CR,opt:{mul:{more:R(0.03)}}} ],                                                    // Pressed Ink
    rw_6_2:[ {on:'twist',do:[{mark:'ss',on:'target',dur:4}]}, {on:'teamIn',if:{srcHas:'ss',targetTeam:'enemy'},more:R(0.015)} ],   // Shared Story
    rw_6_3:[ {on:'teamHeal',if:{unitHas:'rw'},less:R(0.05)} ],                                                  // Unhappy Ending
    rw_7_1:[ {on:'cast',skill:CR,if:{targetHpBelow:0.3,targetAlive:true},do:[{mark:'rwe',on:'target',dur:{opt:'dur',d:6}},{window:'rweW',dur:{opt:'dur',d:6},longest:true}]},   // Rewrite the Ending
             {stat:{hp:-0.10},to:{team:'enemy',has:'rwe'},if:{window:'rweW'}} ],
    rw_7_2:[ {on:'teamIn',if:{targetHas:'rw',srcTeam:'ally'},more:R(0.015)} ],                                  // Footnote
    rw_7_3:[ {stat:{move:R(-0.02)},to:RW,if:{window:'rwW'}} ],                                                  // Cold Ink
    rw_8_1:[ {on:'revGain',do:[{energy:R(1)}]} ],                                                               // Rough Draft
    rw_8_2:[ {param:'pt.n',add:1} ],                                                                            // Two Versions
    rw_8_4:[ {on:'in',if:{srcHas:'rw'},less:R(0.015)} ],                                                        // Slipcase
    rw_9_1:[ {stat:{aspd:R(-0.015)},to:RW,if:{window:'rwW'}} ],                                                 // Red Margin
    rw_9_4:[ {on:'death',if:{who:'enemy',unitHas:'rw',unitUst:{rev:1}},do:[{ustack:'rev',on:{team:'enemy',of:'unit',n:1,skip:'unit'},add:{ust:'rev',of:'unit'}}]} ],   // Unbound
    rw_10_1:[ {on:'teamNrg',if:{unitHas:'rw'},less:R(0.05)} ],                                                  // Censor (energy from being hit)
    rw_10_2:[ {on:'out',if:{casting:'page',targetHas:'rw'},more:R(0.03)} ],                                     // Living Draft
    rw_10_3:[ {on:'out',if:{casting:CR},ignoreMr:R(0.04)} ],                                                    // Torn Out
    rw_11_2:[ {on:'teamIn',if:{targetHas:'ptw',srcTeam:'enemy'},less:R(0.015)} ],                               // Plot Armor
    rw_11_3:[ {stat:{nrg:R(0.02)}} ],                                                                           // Margin Call
    rw_11_4:[ {on:'out',if:{auto:true},more:R(0.04)} ],                                                         // Crisp Pages
    rw_12_1:[ {on:'kit',skill:CR,if:{targetIs:{team:'enemy',boss:true}},opt:{pct:{more:R(0.05)},shred:{more:R(0.05)}}} ],   // Retcon (bosses: the cut deeper)
    rw_12_2:[ {on:'sHit',if:{srcKey:HO,auto:true,targetTeam:'enemy',targetAlive:true},do:[{ustack:'im',on:'target',add:1}]},   // Ink Mastery: up to 10%
              {on:'teamIn',if:{srcTeam:'enemy',srcUst:{im:1}},less:R(0.01),per:{ust:'im',of:'source'},upTo:0.10},
              {on:'in',if:{srcUst:{im:1}},less:R(0.01),per:{ust:'im',of:'source'},upTo:0.10} ],
    rw_12_4:[ {on:'death',if:{who:'enemy',unitHas:'rw'},do:[{cd:'blue',mul:R(-0.2,1)}]} ],                       // Spare Copy
    rw_13_2:[ {on:'cast',skill:FV,do:[{window:'lc',dur:99},{ustack:'rev',on:STRONG3,set:3},{castSkill:'blue',on:STRONG3},{window:'lc',end:true}]},   // The Last Chapter (SIGNATURE)
              {on:'cast',skill:CR,unless:'rw_2_2',if:{window:'lc'},do:[{fn:'rwGive'}]} ],               //   its reversed buffs written into an ally at full strength

    /* ============================== THE LIVING BOOK ============================== */
    lb_1_1:[ {on:'page',do:[{stack:'pc',add:1,full:[{stack:'pc',set:0},{emit:'chapter'}]}]},                    // Chapter's End: every 3rd page spent
             {on:'page',if:{window:'lb2'},do:[{stack:'pc',add:1,full:[{stack:'pc',set:0},{emit:'chapter'}]}]},   //   (a Loose Binding hit spends two)
             {on:'chapter',do:[{emit:'ceHit'}]},
             {on:'ceHit',do:[{dmg:{pct:R(0.08),of:'apow'},on:CE_AREA,tag:'ce'}]} ],
    lb_1_2:[ {on:'out',if:{auto:true},more:R(0.02)} ],                                                          // Ink-Stained Hands
    lb_1_4:[ {on:'page',do:BLOT('target')}, {stat:{aspd:R(-0.02)},to:{team:'enemy',has:'blot'},if:{window:'blotW'}} ],   // Wet Ink: Blot
    lb_2_1:[ {stat:{aspd:R(0.02)},if:{selfMin:{_pages:1}}} ],                                                   // Turning Pages
    lb_2_4:[ {param:'blot.dur',add:R(0.5)} ],                                                                   // Spreading Blot
    lb_3_1:[ {on:'chapter',do:[PAGE_ADD]} ],                                                                    // Epilogue
    lb_3_2:[ {on:'pageW',skill:CR,if:{wasBelow:1},do:[{window:'sch',dur:3}]},                                   // Scholar's Mind: no page held at the press
             {on:'out',if:{casting:CR,window:'sch'},more:R(0.03)}, {on:'cast',skill:CR,do:[{window:'sch',end:true}]},
             {on:'sOut',if:{srcKey:SP,selfBelow:{_pages:1}},more:R(0.03)} ],
    lb_2_3:[ {on:'out',if:{casting:'page'},more:R(0.04)}, {param:'pg.cap',add:[0,0,0,0,1],unless:'lb_5_3'} ],   // Thick Volume (4 pages at 5/5)
    lb_3_4:[ {on:'pagePre',if:{targetHas:'blot'},do:[{window:'ibt',dur:1}]},                                    // Ink Bleeds Through
             {on:'page',if:{window:'ibt'},do:BLOT(CE_AREA)} ],
    lb_4_1:[ {on:'chapter',do:[{energy:R(1)}]} ],                                                               // Running Head
    lb_4_2:[ {on:'cd',less:R(0.015)} ],                                                                         // Quick Hand
    lb_4_3:[ {on:'ccIn',less:R(0.04)} ],                                                                        // Clean Margins
    lb_5_1:[ {on:'out',if:{casting:'page'},more:R(0.05)} ],                                                     // Heavy Pages
    lb_9_3:[ {on:'in',if:{selfMin:{_pages:2}},less:R(0.02)} ],                                                  // Desk Work
    lb_8_4:[ {on:'page',do:[{window:'ol',dur:3}]}, {stat:{armor:R(0.02),mr:R(0.02)},if:{window:'ol'}} ],        // Old Leather
    lb_6_1:[ {param:'ce.r',add:R(0.3)} ],                                                                       // Next Chapter
    lb_6_4:[ {on:'out',if:{targetHas:'blot'},more:R(0.03)} ],                                                   // Dark Ink
    lb_7_1:[ {on:'out',if:{casting:'page'},ignoreMr:R(0.02)} ],                                                 // Page Cut
    lb_7_2:[ {param:'pg.n',add:1} ],                                                                            // Written Twice (the always row)
    lb_7_4:[ {on:'in',if:{srcHas:'blot'},less:R(0.015)} ],                                                      // Ink Ward
    lb_5_2:[ {on:'out',if:{casting:'page',window:'lb2'},mul:2} ],                                               // Loose Binding (PICK ONE; the always row spends the second)
    lb_8_2:[ {on:'out',if:{casting:CR},more:R(0.04),per:{field:'_pages',of:'self'}} ],                          // Spine Crack
    lb_5_3:[ {param:'pg.cap',add:-1}, {on:'out',if:{casting:'page'},more:0.25}, {on:'wave',do:[{field:'_pages',max:2}]} ],   // Tight Binding (PICK ONE)
    lb_5_4:[ {on:'in',if:{srcHas:'blot'},less:R(0.01)}, {on:'teamIn',if:{srcHas:'blot',srcTeam:'enemy'},less:R(0.01)} ],   // Blotted Out
    lb_9_1:[ {on:'out',if:{casting:'page',window:'ce'},more:R(0.03)} ],                                         // Cliffhanger
    lb_9_2:[ {on:'page',if:{selfBelow:{_pages:1},noWindow:'open'},do:[{window:'sr',dur:99}]},                   // Speed Reader
             {on:'cd',if:{window:'sr'},mul:1/1.3,do:[{window:'sr',end:true}]} ],
    lb_10_1:[ {on:'chapter',every:2,do:[{emit:'ceHit'}]} ],                                                     // Long Story: every 2nd Chapter hits twice
    lb_10_3:[ {stat:{nrg:R(0.015)}} ],                                                                          // Ink Well
    lb_10_4:[ {on:'death',if:{who:'enemy',unitHas:'blot'},chance:R(0.2),do:[PAGE_ADD]} ],                        // Final Blot
    lb_11_1:[ {on:'out',if:{auto:true},more:R(0.015),per:{field:'_pages',of:'self'}} ],                         // Rapid Notes
    lb_11_2:[ {on:'sHit',if:{srcKey:HO,auto:true},icd:R(-0.5,2.5),do:[PAGE_ADD]} ],                             // Open Book
    lb_11_4:[ {on:'wave',do:[{field:'_pages',min:R(1),max:P('pg.cap',3)}]} ],                                  // Shelf Life
    lb_12_1:[ {on:'dmg:ce',if:{targetHpBelow:0.5},more:R(0.05)}, {on:'out',if:{casting:'page',window:'ce',targetHpBelow:0.5},more:R(0.05)} ],   // Closing Lines
    lb_12_2:[ {on:'out',if:{casting:'page',mine:HO},more:R(0.03)} ],                                            // Page Storm
    lb_12_3:[ {on:'hit',if:{casting:'page'},do:[{heal:{pct:R(0.05),of:'hit'},on:'self'}]} ],                    // Annotated
    lb_13_2:[ {on:'cast',skill:FV,do:[{window:'open',dur:8}]},                                                  // Every Page at Once (SIGNATURE): 8 s
              {on:'pagePre',if:{window:'open'},do:[{field:'_pages',add:1}]},                                    //   every swing lands a page hit, spending none
              {on:'page',if:{window:'open'},do:BLOT('target')}, {on:'ceHit',if:{window:'open'},do:BLOT(CE_AREA)} ]   //   and every enemy those hits touch is Blotted
  },
  fn:{
    /* a Field Note on the enemy ctx.tgt (once per enemy, max 10); its class is noted (Taxonomy, The Whole Book) */
    note(A,T,u,c){ const t=c.tgt; if(!t||A.markOf(u,t,'noted')||A.stGet(T,'fn')>=10) return; A.setMark(T,u,t,'noted',{}); A.stSet(T,u,'fn',A.stGet(T,'fn')+1);
      (T.s.cls||(T.s.cls={}))[role(t)]=1; A.run(T,u,'noteW',Object.assign({},c,{tgt:t})); },
    noted(A,T,u,c){ return !!(T.s.cls&&c.tgt&&T.s.cls[role(c.tgt)]); },
    /* The Whole Book: for each class he has a Note on (in the order he noted them, up to 3) with an enemy of it on the field, one Lesser Ink Spirit that hunts the
       nearest such enemy, for as long as the Horror has left. They are summons like any other (the field cap of 3 spirits holds) */
    wholeBook(A,T,u,c){ const E=A.eng(), h=c.unit; if(!E.summon||!h) return; const cls=Object.keys(T.s.cls||{}); let n=0;
      for(const k of cls){ if(n>=3) break; const prey=A.pick(T,u,{team:'enemy'},c).filter(x=>role(x)===k).sort((a,b)=>E.dist(h,a)-E.dist(h,b))[0]; if(!prey) continue;
        const lv=(u.skillLv&&u.skillLv[1])||1; let s=null; T.s.ex=1;
        try{ s=E.summon(u,SP,Math.max(0.5,h._summonT||22),{a:(u.team==='ally'?0:Math.PI)+(n-1)*0.7,r:1.6*E.METER(),share:1+0.005*Math.max(0,lv-1)}); } finally{ T.s.ex=0; }
        if(!s) break; A.setMark(T,u,s,'wb',{}); s.target=prey; s.forcedTarget=prey; s.forcedTargetT=s._summonT; n++; } },   // it hunts that enemy (the engine's own forced target)
    wbEnd(A,T,u){ const E=A.eng(); if(!E.unsummon) return; for(const x of A.mineOf(T,u).slice()) if(A.markOf(u,x,'wb')) E.unsummon(x); },
    /* what Chapter Rewrite is about to reverse on its target (read at the kit, before the skill ends it) */
    rwSnap(A,T,u,c){ const t=c.tgt; if(!t){ T.s.rb=null; return; } const b=[];
      if((t.dmgBuffT||0)>0&&(t.dmgBuffMul||1)>1) b.push({k:'dmg',s:t.dmgBuffMul-1,t:t.dmgBuffT});
      if((t.hasteT||0)>0&&(t.hasteMul||1)>1) b.push({k:'haste',s:t.hasteMul-1,t:t.hasteT});
      if((t.drT||0)>0&&(t.drMul==null?1:t.drMul)<1) b.push({k:'dr',s:1-t.drMul,t:t.drT});
      if((t._critBuffT||0)>0&&(t._critBuffPct||0)>0) b.push({k:'crit',s:t._critBuffPct,t:t._critBuffT});
      if(t.hots) for(const h of t.hots) if(h.hps>0&&h.remaining>0) b.push({k:'hot',s:h.hps,t:h.remaining*(h.interval||1),iv:h.interval||1});
      if((t._digHealT||0)>0) b.push({k:'other',s:0,t:t._digHealT});
      T.s.rb={t,b,sh:t.shield||0,shT:t.shieldT||0}; },
    reversed(A,T,u,c){ const rb=T.s.rb; return !!(rb&&rb.t===c.tgt&&rb.b.length); },
    /* Plot Twist: each reversed buff into his lowest-HP ally (two with Two Versions) at 10% per rank of its strength (The Last Chapter: in full) for the time it had left */
    rwGive(A,T,u,c){ const rb=T.s.rb; if(!rb||rb.t!==c.tgt||!rb.b.length) return; const E=A.eng(), k=A.winOn(T,'lc')?1:(T.P['pt.k']||0); if(!(k>0)) return;
      const al=A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:1+(T.P['pt.n']||0)},c);
      for(const a of al){ let d=0; for(const x of rb.b){ if(x.k==='other') continue; if(x.k==='hot') E.pushHot(a,x.s*k,x.t,x.iv); else A.buffOn(a,x.k,x.s*k,x.t); d=Math.max(d,x.t); }
        if(d>0){ A.setMark(T,u,a,'ptw',{dur:d,longest:true}); A.run(T,u,'twist',Object.assign({},c,{tgt:a,unit:a})); } } },
    /* Stolen Shield: the shield the kit row took off it, 40% of it to his lowest-HP ally (its time left, 1 to 6 s) */
    rwSteal(A,T,u,c){ const rb=T.s.rb; if(!rb||rb.t!==c.tgt||!(rb.sh>0)) return; const a=A.pick(T,u,{team:'ally',others:true,order:'lowHp',n:1},c)[0]; if(!a) return;
      a.shield=(a.shield||0)+0.4*rb.sh; a.shieldT=Math.max(a.shieldT||0,Math.min(6,Math.max(1,rb.shT||4))); },
    /* Burnt Shield: the fire spreads to every other enemy within 2 m for 30% of the burn */
    rwSpread(A,T,u,c){ const rb=T.s.rb; if(!rb||rb.t!==c.tgt||!(rb.sh>0)) return; const x=0.3*rb.sh*(1+(T.P.burn||0));
      for(const t of A.pick(T,u,{team:'enemy',of:'target',within:2,skip:'target'},c)) A.hurt(T,u,t,x,'#c8b9e8','bs'); }
  },
  /* one sentence runs, another waits */
  partial:{},
  /* nothing implemented: needs engine work. None: every talent has rows (readings and reworded tooltips in WIRING/12 - ALDREN - talent decisions.md) */
  ruling:{}
};

return module.exports;})();
  MECH["astra"]=(function(){const module={exports:{}};
/* ASTRA - what her learned talents do in a fight (the mechanics; her 9 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 14: what Astra added)
   Her real kit (the code, not the tooltip wording):
   - Starfire ('nova', green, cd 7): cast on the most crowded enemy group at any distance (it forms there 0.35 s later): 110% of ability power x skill level
     to every enemy whose CENTRE is within 2.8 m of its centre (o.radius). No control.
   - Nebula ('aoedot', blue, cd 9): the same placement; 50% of ability power up front to every enemy within 3 m (centre), and a burn on each of them
     (#ffa657, magic: magic resist reduces each tick) of 50% ability power x skill level a second for 4 s (o.dur, whole seconds). The burn is put on AT THE
     CAST: nothing in the game stays on the ground (its picture lasts about the same 4 s of fight time). Talents that speak of "inside Nebula" read its
     circle as a talent zone that stays for its duration (zone 'neb', centre-measured as the skill measures).
   - Collapsing Star ('gravcrush', ultimate, player-aimed or the densest group): every enemy whose centre is within 8 m of its centre takes 200% x level
     and is stunned (the control table's area stun: 2.0 x the 30% cut = 1.4 s). It SETS a drag on every enemy that is not immovable (pulledBy / pullT 0.3 s),
     but the engine's drag has no stopping distance for a point, so today NOBODY MOVES (a game fact, see the rulings file D1). "Enemies it drags in" = the
     enemies in its circle that are not immovable (the ones the skill tries to drag).
   - Stardust (passive): after EVERY hit of hers that lands (basic attacks AND skill hits, not DoT ticks) the enemy gets a new burn of 10% (+0.1 pt a level)
     of her Attack stat each 0.5 s for 2 s (#6fe3d4). Each hit pushes its own burn: they already stack, with no limit, and never refresh.
   - Her damage is magic. The page hook 'at' (this work) tells her rows where each of her three area skills strikes (its centre, its options, its
     damage to each enemy before the target's resist); rows read that place as 'pt:nova' / 'pt:aoedot' / 'pt:gravcrush'.
   "Her burns" = Stardust's, Nebula's and Burning Starfire's, made hers (tags 'sd', 'neb', 'bs'). "Burning" = carrying one of them.
   Talents whose text cannot run against that kit are NOT guessed at: they are written up for the owner in WIRING/08 - ASTRA - talents that need a ruling.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const SF='nova', NEB='aoedot', CS='gravcrush';
const FIRE='#ff8a3a', STAR='#cfe8ff';
const HAZE_HOLD=0.04;                                                             // the Haze is renewed each tick on an enemy inside (a tick is 0.0273 s of fight)
const OOP={mark:['rec','recX','sky'],m:P('oop.m',4)};                             // Out of Place: more than 4 m from the place she recorded for it
const DRAG={team:'enemy',of:'pt:gravcrush',withinOpt:'radius',below:{immovable:1,_gearImmovableT:1e-9}};   // the enemies Collapsing Star drags in
const IN_PT={team:'enemy',of:'pt',withinOpt:'radius'};                            // every enemy the skill (or the zone) holds, centre to centre as the skill measures
const HC={team:'enemy',of:'target',within:2,skip:'target'};                       // Hot Core: enemies within 2 m of the one that Flares
const LG={team:'enemy',of:'pt:gravcrush',within:4};                               // Letting Go: every enemy within 4 m of the centre
const LIGHT=(b,$)=>({b,$,$m:'light.fast'});                                       // Light gained (Coin Turn: 10% more per rank)
const SPEND_U={stack:'light',spend:'all',then:[{stack:'lspU',set:{pct:1,of:'spent'}},{emit:'lightSpent'}]};   // Collapsing Star spends the Held Star
const HAZE=zone=>({on:'tick',req:'sb_1_1',if:{zone},do:[{mark:'haze',on:{team:'enemy',inZone:zone},dur:{b:HAZE_HOLD,$:'haze.linger'},ends:'hazeOff'}]});
const REC=[{mark:'rec',on:{team:'enemy'},clear:true},{mark:'rec',on:{team:'enemy',of:'self',n:P('rec.n',3)},spot:'here'},{window:'rc',dur:P('rec.every',6)}];
module.exports={
  hero:'astra',
  casting:true,                         // rows ask which of her skills a hit comes from
  points:true,                          // rows read where her area skills strike (the 'at' hook)
  states:{
    heat:{unit:true,max:10,dur:P('heat.dur',4),full:'flare',chain:99,longest:true},   // Heat on each enemy: all of it fades 4 s after the last gain; at 10 it Flares
    skyN:{unit:true,max:2,dur:8},                                                  // The Second Sky: drags back so far, on each enemy
    light:{max:{b:100,$:'light.max'}},                                             // the Held Star
    lsp:{}, lspU:{}, nHit:{}, bm:{}                                                // Light spent by this Starfire / this Collapsing Star; enemies this Starfire holds; burning enemies the star holds
  },
  /* needs: a talent that improves a mechanic does nothing without the talent that introduces it */
  needs:{ sb_3_1:'sb_1_1', sb_5_1:'sb_1_1',
          sb_2_4:'sb_1_4', sb_3_4:'sb_1_4', sb_n1:'sb_1_4', sb_4_4:'sb_1_4', sb_6_3:'sb_1_4', sb_6_4:'sb_1_4', sb_5_4:'sb_1_4', sb_8_4:'sb_1_4', sb_n2:'sb_1_4', sb_10_4:'sb_1_4',
          sb_11_3:'sb_1_4', sb_11_4:'sb_1_4', sb_n3:'sb_1_4', sb_13_3:'sb_1_4',
          hs_n1:'hs_1_1', hs_2_1:'hs_1_1', hs_4_1:'hs_1_1', hs_6_1:'hs_1_1', hs_8_1:'hs_1_1', hs_10_1:'hs_1_1', hs_11_1:'hs_1_1',
          hs_2_4:'hs_1_4', hs_3_4:'hs_1_4', hs_n2:'hs_1_4', hs_5_3:'hs_1_4', hs_6_4:'hs_1_4', hs_8_4:'hs_1_4', hs_9_4:'hs_1_4', hs_10_3:'hs_1_4', hs_11_4:'hs_1_4',
          hs_n3:'hs_1_4', hs_12_2:'hs_1_4', hs_12_3:'hs_1_4', hs_12_4:'hs_1_4', hs_13_3:'hs_1_4',
          ss_2_1:'ss_1_1', ss_3_1:'ss_1_1', ss_4_1:'ss_1_1', ss_9_1:'ss_1_1', ss_11_2:'ss_1_1',
          ss_2_3:'ss_1_3', ss_3_3:'ss_1_3', ss_5_3:'ss_1_3', ss_6_3:'ss_1_3', ss_7_4:'ss_1_3', ss_8_3:'ss_1_3', ss_10_3:'ss_1_3', ss_10_4:'ss_1_3', ss_11_3:'ss_1_3', ss_11_1:'ss_1_3', ss_12_4:'ss_1_3' },
  /* run for her whenever she has any mechanic talent: her burns made hers, Nebula's circle on the ground, the Haze, the Held Star's spending */
  always:[
    {on:'hit',if:{selfPass:'stardust',targetAlive:true},do:[{tagDots:'sd',last:true,on:'target',emit:'sdOn'}]},   // the Stardust burn this hit just left
    {on:'kit',skill:NEB,do:[{tagDots:'kit'}]}, {on:'cast',skill:NEB,do:[{tagDots:'neb',exact:true,emit:'nebOn'}]},  // Nebula's burns (Lingering Nebula / Thickening: a part second at the end)
    {on:'at',skill:NEB,unless:'ss_5_1',do:[{zone:'neb',at:'pt',radiusPx:{opt:'radius'},dur:{opt:'dur',d:4},centre:true,ends:'nebEnd'}]},
    HAZE('neb'), HAZE('star'),                                                     // with Haze learned: an enemy in a Nebula (or on the burning star) is in the Haze, and a while after
    {on:'kit',req:'hs_12_3',if:{stackFull:'light'},do:[{window:'wol',dur:99}]}, {on:'cast',req:'hs_12_3',do:[{window:'wol',end:true}]},   // Weight of Light: full as the ability is cast
    {on:'kit',skill:SF,req:'hs_1_4',do:[{stack:'lsp',set:0},{stack:'light',spend:'all',then:[{stack:'lsp',set:{pct:1,of:'spent'}},{emit:'lightSpent'}]}]},   // Starfire spends all the Light
    {on:'kit',skill:CS,do:[{stack:'lspU',set:0},{window:'lg',end:true}]},
    {on:'kit',skill:CS,req:'hs_5_3',do:[SPEND_U]},                                 // Imploding Star: Collapsing Star spends it all
    {on:'kit',skill:CS,req:'hs_13_3',unless:'hs_5_3',if:{stackMin:{light:100}},do:[SPEND_U]}   // Letting Go: so does a Collapsing Star cast with 100 or more
  ],
  talents:{
    /* ============================== SLOW BURN ============================== */
    sb_1_1:[ {on:'tick',do:[{dotRate:R(0.10),on:{team:'enemy',has:'haze'}}]} ],                     // Haze: her burns on enemies in the Haze tick 10% faster (each tick comes sooner)
    sb_1_2:[ {stat:{apow:R(0.01)},if:{any:[{some:{team:'enemy',has:'haze'}},{some:{team:'enemy',ust:{heat:5}}}]}} ],   // Starlight
    sb_1_4:[ {on:'dotTick',do:[{ustack:'heat',on:'target',add:1}]},                                 // Heat: each tick of her burns
             {on:'flare',if:{targetLacks:'flk'},do:[{mark:'flk',on:'target',dur:0.001},              //   a Flare (each enemy once in one chain of Flares)
               {ustack:'heat',on:'target',set:0},{ustack:'heat',on:'target',set:P('cinders',0),if:{p:'cinders',targetHpBelow:0.5}},
               {dmg:{pct:R(0.10),of:'apow'},on:'target',tag:'flare',color:FIRE,emitAmt:'flared'}]} ],
    sb_2_3:[ {on:'dotOut',if:{tag:'sd'},more:R(0.04)} ],                                            // Bright Dust
    sb_2_4:[ {param:'hc',add:1}, {on:'flared',do:[{dmg:{pct:R(0.30),of:'hit'},on:HC,tag:'hc',color:FIRE}]} ],   // Hot Core
    sb_3_1:[ {param:'haze.linger',add:R(0.3)} ],                                                    // Thick Haze
    sb_2_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                 // Quick Spark
    sb_4_3:[ {on:'sdOn',do:[{extendDot:R(0.3)}]} ],                                                 // Dust Storm
    sb_3_4:[ {on:'flared',req:'sb_2_4',do:[{ustack:'heat',on:HC,add:4}]} ],                         // Chain Flare: caught by another enemy's Flare
    sb_n1:[  {on:'flared',do:[{heal:{pct:R(0.002),of:'maxHp'},on:'self'}]} ],                       // Starwarmed
    sb_4_2:[ {param:'neb.r',add:R(0.2)}, {on:'kit',skill:NEB,opt:{radius:{addM:R(0.2)}}} ],         // Wide Nebula
    sb_4_4:[ {on:'dmg:flare',more:R(0.03)} ],                                                       // Ignition Point
    sb_5_1:[ {on:'dotOut',if:{targetHas:'haze'},more:R(0.02)} ],                                    // Haze Bite
    sb_8_2:[ {on:'kit',skill:CS,opt:{radius:{addM:R(0.2)}}} ],                                      // Wider Horizon
    sb_6_1:[ {param:'neb.dur',add:R(0.2)}, {on:'kit',skill:NEB,opt:{dur:{add:R(0.2)}}} ],           // Lingering Nebula
    sb_6_3:[ {on:'hit',if:{casting:SF},do:[{ustack:'heat',on:'target',add:R(1)}]} ],               // Kindling Starfire
    sb_6_4:[ {on:'flared',do:[{energy:R(2)}]} ],                                                    // Flare Feed
    sb_7_2:[ {on:'kit',skill:CS,opt:{mul:{more:R(0.03)}}} ],                                        // Heavy Star
    sb_7_3:[ {on:'hit',if:{casting:SF,targetAlive:true},do:[{dot:'bs',on:'target',amt:{pct:0.15,of:'apow'},dur:P('burn.long',2),every:0.5,color:FIRE}]} ],   // Burning Starfire
    sb_7_4:[ {on:'teamHeal',if:{unitDot:true},less:R(0.03)} ],                                      // Searing
    sb_8_1:[ {on:'kit',skill:NEB,opt:{dps:{more:R(0.05)}}} ],                                       // Settling Haze
    sb_5_2:[ {on:'sdOn',if:{auto:true},do:[{copyDot:'sd',on:{team:'enemy',of:'target',n:1,skip:'target'}}]} ],   // Catching Fire
    sb_5_4:[ {param:'heat.dur',add:R(0.4)} ],                                                       // Warmth Kept
    sb_9_1:[ {on:'cast',skill:CS,do:[{zone:'neb',at:'pt:gravcrush',radius:{b:3,$:'neb.r'},dur:{b:4,$:'neb.dur'},centre:true,ends:'nebEnd'}]} ],   // Haze Collapse (reading: the circle, not a second cast)
    sb_9_2:[ {on:'cd',less:R(0.01)} ],                                                              // Clear Night
    sb_9_3:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetDot:true},more:R(0.015)} ],  // Bright Ledger
    sb_8_4:[ {on:'flared',do:[{slow:R(0.06),dur:2,on:'target'},{slow:R(0.06),dur:2,on:HC,if:{p:'hc'}}]} ],   // Long Flare
    sb_10_2:[ {on:'in',if:{srcDot:true},less:R(0.015)} ],                                           // Heat Mirage
    sb_n2:[  {param:'cinders',add:R(1)} ],                                                          // Cinders Kept (the Flare row reads it)
    sb_10_4:[ {on:'kill',if:{any:[{tag:'flare'},{tag:'hc'}]},do:[{dmg:{pct:1,of:'hit'},on:{team:'enemy',of:'target',within:4,skip:'target'},tag:'nova2',color:FIRE},   // Supernova (reading: 4 m)
               {slow:{rk:'sb_8_4',r:0.06},dur:2,on:{team:'enemy',of:'target',within:4,skip:'target'}}]} ],
    sb_11_3:[ {on:'ccHit',if:{casting:CS,cc:['stunned'],talent:false},do:[{ustack:'heat',on:'target',add:R(3)}]} ],   // Crushed Sparks
    sb_11_4:[ {stat:{aspd:R(-0.003)},per:{ust:'heat',of:'target'},to:{team:'enemy',ust:{heat:1}}} ],   // Fever
    sb_12_1:[ {param:'burn.long',add:R(0.2)}, {on:['sdOn','nebOn'],do:[{extendDot:R(0.2)}]} ],      // Long Glow
    sb_n3:[  {on:'hazeOff',do:[{ustack:'heat',on:'target',touch:true,dur:R(1)}]} ],                 // Carried Heat
    sb_12_3:[ {on:'at',skill:CS,do:[{stack:'bm',set:{units:Object.assign({dot:true},IN_PT),max:5}}]}, {on:'out',if:{casting:CS},more:R(0.01),per:'bm'} ],   // Burning Mass
    sb_13_3:[ {on:'cast',skill:CS,do:[{emit:'flare',on:DRAG},{zone:'star',at:'pt:gravcrush',radius:3,dur:5}]},   // Every Star Burns (SIGNATURE): the dragged Flare at once
              {on:'tick',each:{team:'enemy'},if:{targetIn:'star'},period:0.5,do:[{ustack:'heat',on:'target',add:2}]} ],   //   the burning star: 2 Heat every 0.5 s within 3 m (and the Haze: always row)

    /* ============================== THE HELD STAR ============================== */
    hs_1_1:[ {param:'pt.on',add:1},                                                                 // Points: each enemy Starfire hits, 6 s, at most 3 on the field
             {on:'hit',if:{casting:SF,targetAlive:true},do:[{mark:'pt',on:'target',dur:P('pt.dur',6),cap:3,added:'ptNew'}]},
             {on:'out',if:{targetHas:'pt'},more:R(0.02)} ],
    hs_1_3:[ {on:'out',if:{auto:false},ignoreMr:R(0.03)} ],                                         // Sharp Light
    hs_1_4:[ {on:'hit',if:{auto:true},do:[{stack:'light',add:LIGHT(4,'light.auto')}]},              // Held Star: 4 Light a basic attack
             {on:'cast',do:[{stack:'light',add:LIGHT(10)}]},                                        //   10 an ability (after it: Starfire spends what was there)
             {on:'kit',skill:SF,opt:{mul:{more:R(0.001),per:'lsp'}}} ],                            //   0.1% more per Light spent
    hs_2_2:[ {on:'kit',skill:SF,opt:{mul:{more:R(0.03)}}} ],                                        // Focused Starfire
    hs_n1:[  {on:'out',if:{casting:SF,targetHas:'pt'},more:0.04},                                   // Fixed Stars (LINK)
             {on:'kit',skill:SF,req:'ss_1_3',do:[{window:'fs',dur:99}]}, {on:'cast',skill:SF,req:'ss_1_3',do:[{window:'fs',end:true}]},
             {on:'ptNew',req:'ss_1_3',if:{window:'fs',casting:SF},do:[{window:'fs',end:true},{mark:'recX',on:'target',spot:'here',dur:2}]} ],   //   with Recorded: the first new Point, 2 s
    hs_2_4:[ {param:'light.max',add:R(15)} ],                                                       // Brighter Coin
    hs_2_1:[ {param:'pt.dur',add:R(1)} ],                                                           // Long Points
    hs_4_2:[ {on:'at',skill:SF,do:[{mark:'ctr',on:{team:'enemy'},clear:true},{mark:'ctr',on:Object.assign({n:1},IN_PT)}]},   // Tight Nova: the enemy nearest its centre
             {on:'out',if:{casting:SF,targetHas:'ctr'},more:R(0.06)} ],
    hs_4_3:[ {on:'kit',skill:CS,opt:{stun:{add:R(0.15),ccRaw:true}}} ],                            // Heavier Collapse
    hs_3_4:[ {on:'kit',skill:SF,if:{stackMin:{lsp:100}},do:[{window:'ss',dur:99}]}, {on:'cast',skill:SF,do:[{window:'ss',end:true}]},   // Spent Star
             {on:'hit',if:{casting:SF,window:'ss',targetAlive:true},do:[{stun:0.8,on:'target'}]} ],
    hs_4_1:[ {on:'death',if:{who:'enemy',unitHas:'pt'},do:[{stack:'light',add:{r:8,$m:'light.fast'}}]} ],   // Point by Point
    hs_n2:[  {on:'kit',skill:SF,if:{stackMin:{lsp:50}},do:[{energy:R(1)}]} ],                      // Bright Return
    hs_5_3:[ {on:'kit',skill:CS,opt:{mul:{more:0.003,per:'lspU'}}} ],                               // Imploding Star (the spend: always row)
    hs_5_4:[ {on:'kit',skill:CS,opt:{radius:{addM:2},mul:{more:-0.15}}} ],                          // Wide Collapse
    hs_5_2:[ {on:'kit',skill:SF,opt:{radius:{addM:R(0.1)}}} ],                                      // Open Hand
    hs_3_3:[ {on:'kit',skill:CS,opt:{mul:{more:R(0.03)}}} ],                                        // Collapsing Light
    hs_6_1:[ {on:'out',if:{auto:true,targetHas:'pt'},more:R(0.08)} ],                               // Star Chart
    hs_6_2:[ {on:'cd',skill:'green',add:R(-0.3)} ],                                                 // Quick Starfire
    hs_6_4:[ {on:'wave',do:[{stack:'light',atLeast:R(6)}]} ],                                       // Hoard
    hs_7_1:[ {on:'out',if:{auto:false},more:R(0.025)}, {on:'in',if:{srcMelee:false},more:R(0.02)} ],   // Glass Sky (RISK)
    hs_7_2:[ {on:'at',skill:SF,do:[{after:0.5,do:[{dmg:{pct:0.5,of:'raw'},def:'magic',on:IN_PT,tag:'twin',color:STAR}]}]} ],   // Twin Starfire: the same spot 0.5 s later, half
    hs_8_1:[ {on:'out',if:{casting:SF,targetHas:'pt'},more:R(0.04)} ],                              // Marked Points
    hs_8_3:[ {on:'ccHit',if:{casting:CS,cc:['stunned'],talent:false},do:[{mark:'dc',on:'target',dur:3}]}, {on:'out',if:{targetHas:'dc'},more:R(0.02)} ],   // Deep Collapse
    hs_8_4:[ {param:'light.fast',add:R(0.10)} ],                                                    // Coin Turn
    hs_9_2:[ {on:'at',skill:SF,do:[{stack:'nHit',set:{units:IN_PT}}]}, {on:'out',if:{casting:SF},more:R(0.02),per:{stack:'nHit',over:1,max:4}} ],   // Crowded Sky
    hs_9_3:[ {on:'out',if:{casting:CS,targetHpAbove:0.5},more:R(0.02)} ],                           // Great Mass
    hs_9_4:[ {on:'tick',edge:true,once:'wave',if:{selfHpBelow:0.40},do:[{stack:'light',set:'max'}]} ],   // Flip
    hs_10_1:[ {stat:{move:R(-0.04)},to:{team:'enemy',has:'pt'}} ],                                  // Pinned Points
    hs_10_2:[ {on:'cd',less:R(0.01)} ],                                                             // Night Patience
    hs_10_3:[ {on:'cast',skill:CS,do:[{stack:'light',add:{r:20,$m:'light.fast'}}]} ],               // Let It Go
    hs_11_1:[ {on:'kit',skill:SF,if:{atLeast:{n:3,of:{team:'enemy',has:'pt'}}},do:[{window:'tl',dur:99}]},   // Three Lights: 3 Points as she casts
              {on:'at',skill:SF,if:{window:'tl'},do:[{window:'tl',end:true},{emit:'tlBurst',on:{team:'enemy',has:'pt'}}]},
              {on:'tlBurst',do:[{dmg:{pct:1,of:'raw'},def:'magic',on:{team:'enemy',of:'target',withinOpt:'radius'},tag:'tl',color:STAR}]} ],   //   a burst like Starfire's on each Point
    hs_11_4:[ {on:'in',less:R(0.002),per:{stack:'light',div:10}} ],                                 // Patient Coin
    hs_n3:[  {on:'lightSpent',do:[{stack:'light',add:{pct:R(0.10),of:'spent'}}]} ],                 // Kept Change
    hs_12_2:[ {stat:{armor:R(0.03)},if:{stackMin:{light:50}}} ],                                    // Midnight Coat
    hs_12_3:[ {on:'out',if:{auto:false,window:'wol'},more:R(0.02)} ],                               // Weight of Light (the window: always row)
    hs_12_4:[ {param:'light.auto',add:R(1)} ],                                                      // Steady Coin
    hs_13_3:[ {on:'kit',skill:CS,if:{stackMin:{lspU:100}},do:[{window:'lg',dur:99}]},               // Letting Go (SIGNATURE): cast with 100 or more Light
              {on:'cast',skill:CS,if:{window:'lg'},do:[{window:'lg',end:true},{after:0.3,do:[       //   after the drag (its 0.3 s), on the centre
                {dmg:{pct:2.5,of:'apow'},on:LG,tag:'lg',color:STAR},{extend:'stunned',by:1,on:LG},{mark:'pt',on:LG,dur:P('pt.dur',6),cap:3,if:{p:'pt.on'}}]}]} ],

    /* ============================== THE SECOND SKY ============================== */
    ss_1_1:[ {on:'hit',if:{casting:SF,targetAlive:true},do:[{mark:'orbit',on:'target',dur:P('orbit.dur',3),longest:true},   // Orbit
               {pull:'target',to:'pt:nova',speed:R(0.2),secs:P('orbit.dur',3)}]} ],                 //   drifting 0.2 m a second toward where it burst
    ss_1_3:[ {on:'wave',do:REC}, {on:'end:rc',do:REC},                                              // Recorded: every 6 s, the 3 enemies nearest her
             {on:'out',if:{targetAway:OOP},more:R(0.03)} ],                                         //   Out of Place
    ss_2_1:[ {param:'orbit.dur',add:R(0.5)} ],                                                      // Tight Orbit
    ss_2_3:[ {param:'oop.m',add:R(-0.5)} ],                                                         // Four Degrees
    ss_3_1:[ {on:'in',if:{srcHas:'orbit'},less:R(0.015)}, {on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally',srcHas:'orbit'},less:R(0.015)} ],   // Orbit Weight
    ss_3_2:[ {stat:{move:R(-0.02)},if:{zone:'neb'},to:{team:'enemy',inZone:'neb'}} ],               // Clinging Nebula
    ss_3_3:[ {on:'tick',do:[{slow:0.20,dur:0.2,on:{team:'enemy',away:OOP}}]} ],                     // Moved Star
    ss_4_1:[ {on:'teamIn',if:{targetTeam:'enemy',srcTeam:'ally',targetHas:'orbit'},more:R(0.02)} ], // Bound to Orbit
    ss_4_2:[ {stat:{aspd:R(-0.03)},if:{zone:'neb'},to:{team:'enemy',inZone:'neb'}} ],               // Dense Nebula
    ss_4_4:[ {on:'cd',skill:'blue',add:R(-0.5)} ],                                                  // Patient Ledger
    ss_5_1:[ {on:'at',skill:NEB,do:[{zone:'neb',at:'pt',radiusPx:{opt:'radius'},dur:{opt:'dur',d:4},centre:true,ends:'nebEnd',follow:Object.assign({n:1},IN_PT)}]} ],   // Bright Nebula
    ss_5_2:[ {on:'at',skill:NEB,do:[{window:'dn',dur:1.5}]}, {stat:{move:-1},if:{window:'dn'},to:{team:'enemy',inZone:'neb'}} ],   // Dark Nebula (reading: held in place)
    ss_5_3:[ {param:'rec.n',add:R(1)} ],                                                            // Second Entry
    ss_5_4:[ {on:'ccIn',less:R(0.04)} ],                                                            // Star Calm
    ss_6_1:[ {on:'kit',skill:SF,opt:{radius:{addM:R(0.1)}}} ],                                      // Wide Orbit
    ss_6_3:[ {on:'teamIn',if:{srcIs:'ally',targetAway:OOP},more:R(0.03)} ],                         // Out of Turn
    ss_6_4:[ {on:'kit',skill:CS,opt:{stun:{add:R(0.15),ccRaw:true}}} ],                            // Firm Hand
    ss_7_2:[ {on:'kit',skill:NEB,opt:{dps:{more:R(0.03)}}} ],                                       // Nebula Weight
    ss_7_3:[ {on:'kit',skill:CS,opt:{mul:{more:R(0.03)}}} ],                                        // Heavy Sky
    ss_7_4:[ {on:'cast',skill:CS,do:[{mark:'recX',on:DRAG,spot:'pt:gravcrush',dur:P('rec.every',6)}]} ],   // Rewritten Sky
    ss_8_2:[ {param:'neb.dur',add:R(0.3)}, {on:'kit',skill:NEB,opt:{dur:{add:R(0.3)}}} ],           // Thickening
    ss_8_3:[ {param:'rec.every',add:R(1)} ],                                                        // Mark Kept
    ss_9_1:[ {on:'tick',do:[{slow:R(0.03),dur:0.2,on:{team:'enemy',has:'orbit'}}]} ],               // Captured
    ss_9_2:[ {on:'nebEnd',do:[{pull:IN_PT,to:'pt',secs:0.3},{stun:0.5,on:IN_PT}]} ],                // Star Nursery
    ss_9_4:[ {on:'cd',less:R(0.01)} ],                                                              // Steady Count
    ss_10_1:[ {on:'in',if:{srcBeyond:8},less:R(0.03)} ],                                            // Distant Observer
    ss_10_3:[ {on:'in',if:{srcAway:OOP},less:R(0.015)}, {on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally',srcAway:OOP},less:R(0.015)} ],   // Old Sky
    ss_10_4:[ {on:'death',if:{who:'enemy',unitAway:OOP},do:[{heal:{pct:R(0.01),of:'maxHp'},on:'self'}]} ],   // Ink and Starlight
    ss_11_2:[ {on:'cast',skill:CS,do:[{mark:'orbit',on:DRAG,dur:R(0.4),longest:true},{pull:DRAG,to:'pt:gravcrush',speed:{rk:'ss_1_1',r:0.2},secs:R(0.4)}]} ],   // Star Gravity
    ss_11_3:[ {on:'tick',each:{team:'enemy'},edge:true,if:{targetAway:OOP},do:[{pull:'target',to:{spot:OOP.mark},m:R(0.5),secs:0.3}]} ],   // Back Where It Was
    ss_12_1:[ {stat:{move:R(0.03)}} ],                                                              // Night Breeze
    ss_12_2:[ {on:'cast',skill:CS,do:[{silence:R(0.3),on:DRAG}]} ],                                 // Hushed Sky
    ss_11_1:[ {on:'at',skill:CS,each:IN_PT,icd:12,if:{any:[{targetMin:{immovable:1}},{targetMin:{_gearImmovableT:1e-9}},{targetMin:{stunImmune:1}}]},   // Watcher's Calm
               do:[{mark:'recX',on:'target',spot:'here',dur:R(2),awayFor:R(2)}]} ],
    ss_12_4:[ {on:'in',less:R(0.01),per:{units:{team:'enemy',away:OOP},max:3}} ],                   // Many Wrong
    ss_13_2:[ {on:'cast',skill:CS,do:[{mark:'sky',on:{team:'enemy'},spot:'here',dur:8},{ustack:'skyN',on:{team:'enemy'},set:0}]},   // The Second Sky (SIGNATURE)
              {on:'tick',each:{team:'enemy',has:'sky'},if:{targetAway:{mark:'sky',m:2},targetLacks:'skyL',targetUstBelow:{skyN:2}},   //   more than 2 m from its mark: dragged back, stunned
               do:[{mark:'skyL',on:'target',dur:0.35},{ustack:'skyN',on:'target',add:1},{pull:'target',to:{spot:'sky'},secs:0.3},{stun:0.6,on:'target'}]} ]
  },
  /* one sentence runs, another waits for a ruling */
  partial:{},
  /* nothing implemented: the text cannot run against her real kit. Each one is written up for the owner. */
  ruling:{
    sb_5_3:'"stack on the same enemy, up to 3 at once, instead of refreshing": Stardust burns already stack with no limit and never refresh, so the sentence describes a game that is not there'
  }
};

return module.exports;})();
  MECH["sylthaine"]=(function(){const module={exports:{}};
/* SYLTHAINE - what her learned talents do in a fight (the mechanics; her 8 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   Her real kit (the code, not the tooltip wording):
   - every skill is a FROST ability (dealFrostDamage: the engine flag `_frostHit` is on during the hit); her basic attacks are not.
   - Frozen Orb ('frozenorb', green, cd 8): flies at the farthest enemy within 28 m and hits every enemy in its line: 110% AP, a 2.5 s slow
     through the control table (ccApply: the strength comes from the skill level), and 1 Chill.
   - Glacial Prison ('freeze', blue, cd 9): one target, 120% AP, a stun (the FREEZE) through ccApply, 1 Chill.
   - Blizzard ('blizzard', the ultimate): a 4 s channel on a circle 8 m from its centre; a tick every 0.5 s: 50% AP to every enemy whose centre
     is inside, 1 Chill, and a 10% seeded roll to freeze for 1.2 s x the control cut (written straight on, not through ccApply). She cannot act.
   - Cold Snap (passive, unlocked at rank 3): Chill = the engine's own counter on the enemy (`_chillStacks`, max 5, `_chillT` 10 s from the
     last one). WITHOUT the passive her skills apply no Chill, and neither do her talents.
   - A "freeze" here is a stun SHE lands on an enemy (her only stuns). The always rows below follow each one with a timed mark 'frz'
     that ends when its time is up or the unit is no longer stunned: that end is the event 'freezeEnd' (Thaw, Permafrost, Prison Break).
   Talents whose text cannot run against that kit are NOT guessed at: they are listed in `ruling` and written up for the owner in
   WIRING/05 - SYLTHAINE - talents that need a ruling.md. `partial` lists talents where one sentence runs and another waits. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const ICE='#bfefff';
const ORB_GP=['frozenorb','freeze'];
const FB=()=>({_chillStacks:P('fb.min',5)});                                   // Frostbitten: at 5 Chill (4 with Deep Bite)
const CHILL=(on,n)=>({call:'chill',on,n:n==null?1:n,emit:'chill'});           // a Chill that counts as hers (Snow, Lingering Chill, Glass Winter...)
const GP_FREEZE={casting:'freeze',talent:false,cc:['stunned']};                // the freeze of Glacial Prison itself
const SNOW_SHIELD=rk=>({shield:{pct:{r:0.003,$m:'snow.sh',rk},of:'tgtMaxHp',x:'spent'},dur:P('snow.dur',4),pow:true,emit:'snowShield'});
module.exports={
  hero:'sylthaine',
  casting:true,                         // rows ask "which of her skills is this hit from" (frost abilities vs Blizzard ticks)
  watch:['sw_3_1'],                     // Drift reads the enemy that last hit an ally: every unit of the fight must remember it
  states:{
    snow:{max:P('snow.max',30)},        // Snowpack
    focus:{max:10},                     // Cold Focus
    hailc:{},                           // basic attacks since the last Hailstone
    ht:{}                               // 1 while she was struck since the last tick (Cold Focus)
  },
  /* needs: a talent that improves a mechanic does nothing without the talent that introduces it */
  needs:{ ws_2_1:'ws_1_1', ws_3_1:'ws_1_1', ws_4_1:'ws_1_1', ws_6_1:'ws_1_1', ws_7_1:'ws_1_1', ws_8_1:'ws_1_1', ws_10_1:'ws_1_1', ws_10_4:'ws_1_1', ws_11_1:'ws_1_1',
          ws_5_4:'ws_3_4', ws_8_4:'ws_3_4', ws_9_4:'ws_3_4', ws_6_4:'ws_3_4',
          sp_7_2:'sp_2_2', sp_3_4:'sp_1_4', sp_5_4:'sp_1_4', sp_6_4:'sp_1_4', sp_8_4:'sp_1_4', sp_11_4:'sp_1_4', sp_12_4:'sp_1_4', sp_9_4:'sp_1_4', sp_11_2:'sp_1_4',
          sw_4_2:'sw_3_2', sw_8_3:'sw_3_2', sw_9_3:'sw_3_2', sw_12_2:'sw_3_2', sw_9_4:'sw_1_4', sw_10_1:'sw_1_1' },
  /* run for her whenever she has any mechanic talent: bookkeeping of her freezes, Blizzard's circle and tick, the Icebreaker itself */
  always:[
    {on:'ccHit',if:{cc:['stunned'],targetTeam:'enemy'},do:[{mark:'frz',on:'target',dur:{pct:1,of:'hit'},while:'stunned',ends:'freezeEnd'}]},
    {on:'ccHit',if:{cc:['stunned'],targetTeam:'enemy',casting:'freeze',talent:false},do:[{mark:'gpz',on:'target',dur:{pct:1,of:'hit'},while:'stunned',ends:'gpEnd'}]},
    {on:'cast',skill:'blizzard',do:[{zone:'blizz',at:{x:'_blizzX',y:'_blizzY'},radius:P('blizz.r',8),dur:{opt:'dur',d:4},centre:true},{window:'bliz',dur:{opt:'dur',d:4}}]},
    {on:'num',skill:'blizzR',do:[{emit:'blizzTick'}]},                        // once per Blizzard tick, just before it lands
    {on:'ccHit',if:{casting:'frozenorb',cc:['slow']},do:[{slowMore:P('orb.slow',0),on:'target'}]},   // Frozen Orb's slow, made stronger by the slow talents
    /* the Icebreaker (Shatter): the freeze ends, the enemy takes the shatter's damage (Icebreaker's own rank) */
    {on:'shatter',do:[{endCc:'stunned',on:'target'},{mark:'frz',on:'target',clear:true,fire:true},{dmg:{pct:{rk:'sp_2_2',r:0.08},of:'apow'},on:'target',tag:'ib',color:ICE,emit:'ibHit'},{emit:'shattered'}]}
  ],
  talents:{
    /* ============================== THE WINTER SEAL ============================== */
    ws_1_1:[ {stat:{aspd:R(-0.02)},to:{team:'enemy',min:FB()}} ],                                   // Deep Chill: Frostbitten enemies attack slower
    ws_2_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                  // Glacial Patience
    ws_1_4:[ {param:'chill.dur',add:R(1)}, {on:'chill',do:[{timer:'_chillT',min:P('chill.dur',10),on:'target'}]} ],   // Lingering Chill
    ws_2_1:[ {on:'teamHeal',if:{who:'enemy',unitMin:FB()},less:R(0.06)} ],                          // Bitter Bite
    ws_2_2:[ {on:'ccHit',if:GP_FREEZE,once:'wave',do:[{mark:'seal',on:'target',unique:true}]},      // Winter Seal: the first enemy Glacial Prison freezes each wave
             {stat:{cdRate:R(-0.03)},to:'holder:seal'} ],                                           //   its cooldowns recover slower
    ws_3_1:[ {param:'fb.min',add:-1} ],                                                             // Deep Bite: Frostbite at 4 Chill
    ws_3_3:[ {on:'ccIn',less:R(0.04)} ],                                                            // Cold Blood
    ws_3_4:[ {on:'freezeEnd',do:[{zone:'perma',at:'target',radius:P('perma.r',1),dur:P('perma.dur',2)}]},   // Ground Freeze: Permafrost (reading: "2 m wide" = 1 m from its centre to a body)
             {on:'tick',if:{zone:'perma'},do:[{slow:R(0.04),dur:P('perma.grip',0.2),on:{team:'enemy',inZone:'perma'}}]} ],
    ws_4_1:[ {on:'in',if:{srcMin:FB()},less:R(0.015)}, {on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally',srcMin:FB()},less:R(0.015)} ],   // Brittle Will
    ws_4_2:[ {on:'death',if:{unitHas:'seal'},do:[{mark:'seal',on:{team:'enemy',of:'unit',n:1},unique:true},{stun:R(0.3),on:'holder:seal'}]} ],   // Seal Passes
    ws_4_3:[ {param:'orb.slow',add:R(0.05)} ],                                                      // Frost Lattice (reading: the slow's strength x (1 + 5% per rank))
    ws_5_1:[ {on:'ccOut',if:{cc:['stunned']},more:R(0.02)} ],                                       // Hard Frost: every freeze she causes
    ws_5_4:[ {param:'perma.dur',add:R(0.3)} ],                                                      // Black Ice
    ws_6_1:[ {stat:{move:R(-0.04)},to:{team:'enemy',min:FB()}} ],                                   // Numb Limbs
    ws_6_2:[ {on:'ccHit',if:{cc:['stunned'],targetHas:'seal'},do:[CHILL('target',R(1))]} ],         // Sealed in Frost
    ws_6_4:[ {on:'teamIn',if:{targetTeam:'enemy',targetIn:'perma'},more:R(0.02)} ],                 // Rime Footing (team-wide)
    ws_7_1:[ {stat:{armor:R(-0.02),mr:R(-0.02)},to:{team:'enemy',min:FB()}} ],                      // Hoarfrost Grip
    ws_7_2:[ {on:'gpEnd',if:{targetHas:'seal'},do:[{silence:1,on:'target'}]} ],                     // Iron Seal: silenced 1 s after the prison's freeze ends
    ws_7_3:[ {on:'num',skill:'blizzFreeze',add:R(0.01)} ],                                          // Snowblind: 10% -> 15% a tick
    ws_8_3:[ {param:'blizz.r',add:R(0.2)}, {on:'num',skill:'blizzR',addM:R(0.2)} ],                 // Storm Gathering: 8 m -> 9 m
    ws_5_2:[ {on:'ccHit',if:GP_FREEZE,do:[{stun:{pct:0.5,of:'hit'},asIs:true,on:{team:'enemy',of:'target',within:4,n:1,skip:'target'}}]} ],   // Twin Prison: half of the freeze as it landed
    ws_5_3:[ {on:'ccOut',if:GP_FREEZE,add:0.6}, {on:'ccOut',if:Object.assign({targetHas:'seal'},GP_FREEZE),add:0.6} ],   // Deep Prison
    ws_8_4:[ {param:'perma.r',add:R(0.15)} ],                                                       // Frozen Fields: 0.3 m more ground = 0.15 m more from its centre
    ws_8_1:[ {on:'out',if:{srcFlag:'_frostHit',targetMin:FB()},more:R(0.03)} ],                     // Ice in the Veins
    ws_9_2:[ {on:'teamIn',if:{targetTeam:'enemy',targetHas:'seal'},more:R(0.02)} ],                 // Unbroken Seal (team-wide, her own hits too)
    ws_9_3:[ {on:'cd',skill:'green',add:R(-0.2)} ],                                                 // Patient Frost
    ws_9_4:[ {param:'perma.grip',add:0.8} ],                                                        // Winter Grip: the slow holds 1 s after stepping off
    ws_10_1:[ {on:'death',if:{who:'enemy',unitMin:FB()},do:[CHILL({team:'enemy',of:'unit',n:1},{field:'_chillStacks',of:'unit'})]} ],   // Spreading Bite
    ws_10_3:[ {on:'ccHit',if:{cc:['stunned'],targetTeam:'enemy'},do:[{energy:R(1)}]} ],             // Cold Patience
    ws_10_4:[ {on:'in',if:{srcMin:FB()},less:R(0.02)} ],                                            // Hushed Ground
    ws_11_1:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',min:FB()}} ],                                  // Marrow Frost
    ws_11_2:[ {on:'ccOut',if:Object.assign({targetHas:'seal'},GP_FREEZE),add:R(0.2)} ],             // Seal of Ages
    ws_12_2:[ {on:'kit',skill:'blizzard',opt:{dur:{add:R(0.1)}}} ],                                 // Endless Winter
    ws_11_3:[ {on:'cd',less:R(0.015)} ],                                                            // Still Mind
    ws_12_4:[ {on:'teamIn',if:{targetTeam:'enemy',targetHas:'frz',srcIs:'ally'},more:R(0.04)} ],    // Thin Ice: her allies' hits (not her own)
    ws_13_2:[ {on:'end:bliz',do:[{zone:'lw',at:{x:'_blizzX',y:'_blizzY'},radius:P('blizz.r',8),dur:8,centre:true},{window:'lw',dur:8},{mark:'lwf',on:{team:'enemy'},clear:true}]},   // The Long Winter (SIGNATURE)
              {on:'tick',each:{team:'enemy'},if:{window:'lw',targetIn:'lw'},period:1,do:[CHILL('target')]},   //   1 Chill every second inside
              {on:'tick',if:{window:'lw'},do:[{slow:0.30,dur:0.2,on:{team:'enemy',inZone:'lw'}},{silence:0.2,on:{team:'enemy',inZone:'lw',has:'seal'}}]},   //   slowed 30%; the Sealed enemy cannot use abilities
              {on:'chill',if:{window:'lw',targetIn:'lw',targetMin:{_chillStacks:5},targetLacks:'lwf'},do:[{mark:'lwf',on:'target'},{stun:1.5,on:'target'}]} ],   //   at 5 Chill: frozen 1.5 s, once per enemy

    /* ============================== SHATTERPOINT ============================== */
    sp_1_1:[ {on:'hit',if:{auto:true},do:[{stack:'hailc',add:1}]},                                  // Hailstones: every 4th basic attack
             {on:'hit',if:{auto:true,stackMin:{hailc:P('hail.n',4)}},do:[{stack:'hailc',set:0},{dmg:{pct:R(0.06),of:'apow'},on:'target',tag:'hail',color:ICE},CHILL('target'),{emit:'hail'}]} ],
    sp_1_3:[ {on:'out',if:{srcFlag:'_frostHit',targetMin:{_chillStacks:1}},ignoreMr:R(0.02)} ],     // Biting Cold
    sp_1_4:[ {on:'tick',if:{stackEmpty:'ht'},period:1,rate:P('focus.rate',1),do:[{stack:'focus',add:1}]},   // Cold Focus: a full second without damage
             {on:'tick',do:[{stack:'ht',set:0}]},
             {on:['hurt','dotIn'],do:[{stack:'ht',set:1},{stack:'focus',keep:P('focus.keep',0.5),whole:true}]},   //   damage removes half (rounded down to whole Focus)
             {stat:{apow:R(0.003)},per:'focus'} ],
    sp_2_1:[ {on:'dmg:hail',more:R(0.10)} ],                                                        // Heavy Hail
    sp_2_2:[ {on:'hit',if:{casting:ORB_GP,targetHas:'frz',targetLacks:'gw'},do:[{emit:'shatter'}]} ],   // Icebreaker (reading: her two cast abilities; Blizzard ticks do not shatter)
    sp_3_1:[ {param:'hail.n',add:-1} ],                                                             // Hail Rhythm: every 3rd
    sp_4_2:[ {on:'ibHit',do:[{dmg:{pct:R(0.10),of:'spent'},on:{team:'enemy',of:'target',within:P('shrap.r',3),skip:'target'}}]} ],   // Shrapnel
    sp_n1:[  {on:'dmg:ib',if:{targetMin:{_chillStacks:5}},more:0.05},                               // Marked in Ice (LINK)
             {on:'dmg:ib',req:'ws_2_2',if:{targetHas:'seal'},more:0.10},                            //   ...with Winter Seal: +10% on the Sealed
             {on:'shatter',req:'ws_2_2',once:'wave',if:{noHolder:'seal'},do:[{mark:'seal',on:'target',unique:true}]} ],   //   and the first Icebreaker of the wave Seals when nobody is Sealed
    sp_3_4:[ {on:'kit',if:{stackMin:{focus:10}},do:[{window:'clear',dur:99}]},                      // Clear Air: at 10 Focus the next ability...
             {on:'cast',if:{window:'clear'},do:[{stack:'focus',spend:'all',then:[{emit:'clearSpent'}]},{window:'clear',end:true},{window:'clearB',dur:{opt:'dur',d:4},if:{skill:'blizzard'}}]},
             {on:'out',if:{srcFlag:'_frostHit',window:'clear'},more:R(0.04)}, {on:'out',if:{srcFlag:'_frostHit',window:'clearB'},more:R(0.04)} ],   //   ...deals more (Blizzard: for its whole channel)
    sp_5_1:[ {on:'hail',do:[{slow:R(0.03),dur:1.5,on:'target'}]} ],                                 // Sleet
    sp_5_2:[ {on:'kit',skill:'frozenorb',do:[{fn:'orbLine'}]},                                      // Crushing Orb: the first enemy along the orb's line
             {on:'out',if:{casting:'frozenorb',targetHas:'orb1'},more:0.25},
             {on:'hit',if:{casting:'frozenorb',targetHas:'orb1'},do:[{mark:'orb1',on:'target',clear:true},{stun:0.6,on:'target'}]} ],
    sp_5_3:[ {on:'kit',skill:'frozenorb',do:[{fn:'orbLine'}]},                                      // Splitting Orb: a burst at the end of the line (the farthest enemy)
             {on:'hit',if:{casting:'frozenorb',targetHas:'orbEnd'},do:[{mark:'orbEnd',on:'target',clear:true},{dmg:{pct:0.5,of:'hit'},on:{team:'enemy',of:'target',within:3}}]} ],
    sp_5_4:[ {param:'focus.rate',add:R(0.10)} ],                                                    // Stillness
    sp_4_1:[ {on:'hail',req:'sp_2_2',if:{targetHas:'frz',targetLacks:'gw'},do:[{emit:'shatter'}]},  // Hailbreaker
             {on:'hail',req:'sp_13_2',if:{targetHas:'gw'},do:[{emit:'shatter'}]} ],
    sp_6_3:[ {param:'orb.slow',add:R(0.04)}, {on:'ccOut',if:{casting:'frozenorb',cc:['slow']},add:R(0.2)} ],   // Trailing Frost
    sp_2_3:[ {on:'out',if:{casting:'frozenorb'},more:R(0.04)} ],                                    // Sharp Frost
    sp_6_4:[ {on:'out',if:{srcFlag:'_frostHit',stackMin:{focus:5}},more:R(0.02)} ],                 // Calm Before
    sp_7_1:[ {on:'hail',do:[{cd:'blue',add:R(-0.1)}]} ],                                            // Hail Clock
    sp_6_2:[ {on:'dmg:ib',more:R(0.05),per:{field:'_chillStacks',of:'target'}} ],                   // Fault Lines
    sp_7_2:[ {on:'gpEnd',if:{broke:false},do:[{emit:'shatter'}]} ],                                 // Prison Break: when the prison's freeze runs its time
    sp_8_3:[ {on:'out',if:{casting:ORB_GP},more:R(0.02)} ],                                         // Cold Precision
    sp_7_4:[ {on:'in',more:R(0.01)}, {on:'out',if:{srcFlag:'_frostHit'},more:R(0.02)} ],            // Reckless Cold (RISK)
    sp_8_1:[ {on:'dmg:hail',if:{targetMin:{_chillStacks:1}},more:R(0.10)} ],                        // Shattering Hail
    sp_8_4:[ {param:'focus.keep',add:R(0.10)} ],                                                    // Deep Calm
    sp_4_3:[ {stat:{hp:R(-0.02),apow:R(0.02)}} ],                                                   // Glass Heart (RISK)
    sp_9_3:[ {on:'out',if:{targetMin:{_chillStacks:1}},more:R(0.01)} ],                             // Brittle Bones
    sp_9_4:[ {on:'kit',skill:'freeze',if:{stackMin:{focus:10}},do:[{window:'fm',dur:99}]},          // Frozen Moment (reading: as long as the prison's own freeze)
             {on:'ccHit',if:Object.assign({window:'fm'},GP_FREEZE),do:[{stun:{pct:1,of:'hit'},asIs:true,on:{team:'enemy',of:'target',within:3,skip:'target'}}]},
             {on:'cast',do:[{window:'fm',end:true}]} ],
    sp_10_1:[ {on:'kill',if:{tag:'hail'},do:[{stack:'hailc',set:P('hail.n',3)}]} ],                 // Hailfall: the next basic attack is a Hailstone
    sp_10_3:[ {on:'out',if:{srcFlag:'_frostHit',selfPass:'coldsnap'},more:R(0.005),per:{field:'_chillStacks',of:'target',max:5}} ],   // Deeper Snap
    sp_10_4:[ {on:'out',if:{srcFlag:'_frostHit',targetHpAbove:0.70},more:R(0.02)} ],                // Opening Frost
    sp_11_2:[ {on:'shattered',do:[{stack:'focus',add:R(1)}]} ],                                     // Thousand Shards
    sp_11_3:[ {on:'dmg:ib',more:R(0.03)} ],                                                         // Winter Edge
    sp_11_4:[ {on:'in',if:{stackMin:{focus:5}},less:R(0.04)} ],                                     // Glass Nerves
    sp_12_2:[ {param:'shrap.r',add:R(0.3)} ],                                                       // Cracked Mirror
    sp_12_4:[ {on:'clearSpent',do:[{energy:R(1)}]} ],                                               // Spent Focus
    sp_13_2:[ {on:'chill',by:'target',icd:12,if:{targetMin:{_chillStacks:5}},do:[{stun:0.8,on:'target'},{mark:'gw',on:'target'}]},   // Glass Winter (SIGNATURE): flash-frozen at 5 Chill
              {on:'hit',if:{casting:ORB_GP,targetHas:'gw'},do:[{emit:'shatter'}]},                  //   her next frost hit on it is an Icebreaker
              {on:'dmg:ib',if:{targetHas:'gw'},mul:2},                                              //   that deals double
              {on:'shattered',if:{targetHas:'gw'},do:[{mark:'gw',on:'target',clear:true},CHILL({team:'enemy',of:'target',within:4},3)]} ],   //   and gives 3 Chill within 4 m

    /* ============================== SNOWWARDEN ============================== */
    sw_1_1:[ {on:'chill',do:[{stack:'snow',add:1}]},                                                // Snowpack: every Chill she applies
             {on:'tick',each:{team:'ally',others:true},edge:true,if:{targetHpBelow:0.40},icd:8,do:[{stack:'snow',spend:10,then:[Object.assign({on:'target'},SNOW_SHIELD())]}]},
             {on:'snowShield',do:[{mark:'snowsh',on:'target',dur:P('snow.dur',4),while:'shield',ends:'snowGone'}]} ],
    sw_1_4:[ {on:'freezeEnd',do:[{emit:'thaw',on:{team:'ally',others:true,of:'target',n:1}}]},     // Thaw: the ally nearest the melting ice
             {on:'thaw',unless:'sw_2_4',do:[{heal:{pct:{r:0.06,$m:'thaw.more'},of:'apow',k:1},pow:true,on:'target',tag:'thaw',emit:'thawed'}]},
             {on:'thaw',req:'sw_2_4',do:[{hot:{pct:{r:0.06,$m:'thaw.more'},of:'apow',k:1},dur:3,every:1,pow:true,on:'target',tag:'thaw',emit:'thawed'}]} ],   //   with Meltwater: over 3 s
    sw_2_1:[ {param:'snow.max',add:R(5)} ],                                                         // Deep Snow
    sw_2_4:[ {param:'thaw.more',add:R(0.15)} ],                                                     // Meltwater (the change to a heal over time is Thaw's second row)
    sw_3_1:[ {on:'snowShield',do:[{slow:0.30,dur:2,on:'lastHit'}]} ],                               // Drift
    sw_3_2:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',of:'self',within:P('cold.r',5)}} ],             // Still Cold: a ring around her
    sw_n1:[  {on:'in',if:{srcBeyond:6},less:R(0.02)} ],                                             // Thick Furs
    sw_4_1:[ {param:'snow.dur',add:R(0.4)} ],                                                       // Packed Ice
    sw_4_2:[ {on:'tick',each:{team:'enemy'},if:{targetWithin:P('cold.r',5)},period:[3,2,1],do:[CHILL('target')]} ],   // Biting Air
    sw_4_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                  // Winter's Reach
    sw_5_1:[ {on:'teamIn',if:{targetHas:'snowsh',srcTeam:'enemy'},less:R(0.02)} ],                  // Snowbound
    sw_5_4:[ {on:'thawed',do:[{heal:{pct:R(0.10),of:'hit'},on:{team:'ally',others:true,of:'target',skip:'target',n:1},emit:'gave'}]} ],   // Running Water (reading: the ally nearest the one healed)
    sw_6_1:[ {on:'snowGone',if:{broke:true},do:[{dmg:{pct:R(0.20),of:'apow'},on:{team:'enemy',of:'unit',within:2},color:ICE}]} ],   // Avalanche: the shield was used up
    sw_6_2:[ {on:'ccOut',if:GP_FREEZE,add:R(0.2)} ],                                                // Cold Sleep. PARTIAL: the Ice Tomb half waits with Ice Tomb
    sw_6_3:[ {stat:{apow:R(0.015)},if:{stackMin:{snow:10}}} ],                                      // Wintermind
    sw_7_2:[ {on:'teamIn',if:{window:'bliz',targetTeam:'ally',targetIn:'blizz',srcTeam:'enemy'},less:0.20} ],   // Quiet Ward
    sw_7_3:[ {param:'orb.slow',add:R(0.04)} ],                                                      // Frost Veil
    sw_7_4:[ {on:'thawed',do:[{stack:'snow',add:R(1)}]} ],                                          // Snowmelt
    sw_8_1:[ {param:'snow.sh',add:R(0.03)} ],                                                       // Glacier Wall
    sw_8_3:[ {param:'cold.r',add:R(0.5)} ],                                                         // Hard Winter
    sw_8_4:[ {on:'heal:thaw',if:{targetHpBelow:0.50},more:R(0.05)} ],                               // Clear Water
    sw_9_2:[ {on:'blizzTick',do:[{heal:{pct:R(0.003),of:'tgtMaxHp'},pow:true,on:{team:'ally',others:true,inZone:'blizz'},emit:'gave'}]} ],   // Shelter of Snow
    sw_9_3:[ {on:'in',if:{srcWithin:P('cold.r',5)},less:R(0.01)}, {on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally',srcWithin:P('cold.r',5)},less:R(0.01)} ],   // Snow Blind
    sw_9_4:[ {on:'tick',once:'wave',if:{some:{team:'ally',others:true,hpBelow:0.20}},do:[{emit:'thaw',on:{team:'ally',others:true,hpBelow:0.20,order:'lowHp',n:1},k:3}]} ],   // Wellspring
    sw_10_1:[ {on:'cast',skill:'freeze',if:{stackFull:'snow'},do:[{stack:'snow',spend:10,then:[Object.assign({on:{team:'ally',others:true,of:'target',n:1}},SNOW_SHIELD('sw_1_1'))]}]} ],   // Overflowing Snow (reading: a Snowpack shield)
    sw_10_3:[ {on:'cd',less:R(0.01)} ],                                                             // Steady Hand
    sw_11_1:[ {on:'wave',do:[{stack:'snow',atLeast:R(5)}]} ],                                       // Snowkeeper
    sw_11_2:[ {on:['snowShield','thawed','gave'],do:[{mark:'mercy',on:'target',dur:3}]},            // Winter Mercy
              {on:'teamIn',if:{targetHas:'mercy',srcTeam:'enemy'},less:R(0.03)} ],
    sw_11_4:[ {param:'thaw.more',add:R(0.03)} ],                                                    // Kind Frost
    sw_12_2:[ {stat:{move:R(-0.02)},to:{team:'enemy',of:'self',within:P('cold.r',5)}} ],            // White Silence
    sw_12_3:[ {on:'blizzTick',do:[{stack:'snow',add:{units:{team:'enemy',inZone:'blizz'},max:R(1)}}]} ],   // Snowfall
    sw_12_4:[ {on:'hurt',by:'source',icd:[3,2,1],do:[CHILL('source')]} ],                           // Cold Shoulder
    sw_13_2:[ {on:'teamLethal',by:'unit',once:'fight',if:{who:'ally',unitWithin:8},do:[            // The Quiet Snow (SIGNATURE)
                {mark:'tomb',on:'unit',dur:2,ends:'tombEnd'},{timer:'stunned',min:2,on:'unit'},{stun:2,on:'lastHit'},{atOne:'unit'}]},
              {on:'teamLethal',if:{unitHas:'tomb'},do:[{atOne:'unit'}]},                            //   held at 1 HP in the ice
              {on:'teamIn',if:{targetHas:'tomb'},mul:0},                                            //   and cannot be hurt
              {on:'tombEnd',do:[{stack:'snow',spend:'all',then:[{heal:{pct:0.01,of:'tgtMaxHp',x:'spent'},pow:true,on:'target',emit:'gave'}]}]} ]
  },
  /* one sentence runs, another waits for a ruling */
  partial:{
    sw_6_2:'"an ally encased by Ice Tomb heals 3% more": Ice Tomb itself waits for a ruling; the longer Glacial Prison freeze runs'
  },
  /* nothing implemented: the text cannot run against her real kit. Each one is written up for the owner. */
  ruling:{
    sp_9_2:'Blizzard ticks and the Icebreaker: does a tick end the freeze?',
    sp_12_1:'no "behind the target" on an open field',
    sw_5_2:'Glacial Prison is an enemy skill: turning it onto an ally is new engine behaviour',
    sw_5_3:'Glacial Prison takes the target the engine gives it: choosing another is new engine behaviour'
  },
  fn:{
    /* Crushing Orb / Splitting Orb: which enemies the orb meets first and last. The same line as the skill's own code (the farthest enemy within
       its range, and every enemy within its width of that line); 'orb1' = the nearest along it, 'orbEnd' = the farthest (where it ends). */
    orbLine(A,T,u,ctx){ const E=A.eng(), o=ctx.o||{}, reach=o.range||28*E.METER(), W=o.width||0;
      const inR=E.units().filter(x=>x.alive&&x.team!==u.team&&!x._dropHidden&&!x._noTarget&&!(x._riseT>0)&&E.dist(u,x)<=reach); if(!inR.length) return;
      const far=inR.slice().sort((a,b)=>E.dist(u,b)-E.dist(u,a))[0], dx=far.x-u.x, dy=far.y-u.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
      let first=null, best=Infinity; for(const x of inR){ const rx=x.x-u.x, ry=x.y-u.y, al=rx*ux+ry*uy; if(al<-12||al>len+24||Math.abs(rx*uy-ry*ux)>W) continue; if(al<best){ best=al; first=x; } }
      if(T.r.sp_5_2&&first) A.setMark(T,u,first,'orb1',{}); if(T.r.sp_5_3) A.setMark(T,u,far,'orbEnd',{}); }
  }
};

return module.exports;})();
  MECH["vael"]=(function(){const module={exports:{}};
/* VAEL - what his learned talents do in a fight (the mechanics; his 8 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   His real kit (the code, not the tooltip wording): every point of damage Vael deals is a BASIC ATTACK. Warcry ('warcry') is a self damage
   buff + a fear around him; Bloodthirst ('lifestealbuff') is a self buff (lifesteal, attack speed, crit) with no target and no damage;
   Last Stand ('laststand') is damage reduction + 100% lifesteal + a heal; Blood Rage is a continuous percent, not stacks.
   Talents whose text cannot run against that kit are NOT guessed at: they are listed in `ruling` (id -> short reason) and written up for
   the owner in WIRING/04 - VAEL - talents that need a ruling.md. `partial` lists talents where one sentence runs and another waits. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything his learned talents add to the named number
const BLEED='#8f8fa8', BURN='#ff6a3a';
const AROUND=m=>({team:'enemy',of:'self',within:m});
module.exports={
  hero:'vael',
  /* tracked things. max / dur may be changed by other talents through named numbers. */
  states:{
    temper:{max:20},                                             // Forge Heat. The tooltips name no fade rate: none until ruled (see ruling ib_4_1)
    bank:{max:{pct:P('bank.max',0.15),of:'maxHp'}},              // Blood Bank: a pool of HP
    scars:{max:P('scars.max',10)},                               // whole fight
    footing:{max:5},
    momentum:{max:3,dur:P('momentum.dur',4)},                    // Blood Momentum: all stacks drop `dur` s after the last kill
    trophy:{max:5},
    cb:{max:3},                                                  // Counterblow's count of hits taken
    ledger:{}                                                    // Oath Ledger: damage taken through the Oath
  },
  /* run for Vael whenever he has any mechanic talent: the buff windows of his three skills, so rows can say "during Bloodthirst" */
  always:[
    {on:'cast',skill:'lifestealbuff',do:[{window:'bloodthirst',dur:{opt:'dur',d:6}}]},
    {on:'cast',skill:'laststand',do:[{window:'laststand',dur:{opt:'dur',d:5}},{window:'bloodthirst',end:true}]},   // Last Stand's cast replaces the running lifesteal buff
    {on:'cast',skill:'warcry',do:[{window:'warcry',dur:{opt:'dur',d:6}}]}
  ],
  talents:{
    /* ============================== RED HARVEST ============================== */
    rh_1_1:[ {on:'hit',once:'wave',do:[{mark:'quarry',unique:true}]},                       // Mark the Quarry: the first enemy he hits each wave
             {on:'out',if:{targetHas:'quarry'},more:R(0.02)} ],
    rh_1_4:[ {on:'kill',do:[{dmg:{pct:{r:0.20,$:'spill'},of:'overkill'},on:{team:'enemy',of:'target',n:1}}]} ],   // Spill Over: overkill carries to the enemy nearest the one that died
    rh_2_1:[ {stat:{move:R(0.04)},if:{targetHas:'quarry'}} ],                               // Close the Distance (reading: while the Quarry is his current target)
    rh_2_2:[ {on:'hit',if:{crit:true},do:[{dot:'bleed',amt:{pct:R(0.04),of:'hit'},dur:P('bleed.dur',3),every:1,color:BLEED}]} ],   // Open Wounds
    rh_n2:[  {on:'in',if:{anyDot:'bleed'},less:0.04},                                        // Blood Temper (LINK)
             {on:'dotTick',req:'ib_1_1',if:{tag:'bleed'},every:3,do:[{stack:'temper',add:1}]} ],   // ...with Forge Heat: every 3rd bleed tick gives 1 Temper
    rh_3_1:[ {on:'death',if:{unitHas:'quarry'},do:[{mark:'quarry',on:{team:'enemy',of:'self',n:1},unique:true},{mark:'pick',on:'holder:quarry'}]},   // Pick the Next
             {on:'crit',if:{targetHas:'pick'},force:true,do:[{mark:'pick',clear:true}]} ],
    rh_3_3:[ {on:'out',if:{targetDot:'bleed'},ignoreArmor:R(0.03)} ],                       // Sunder
    rh_3_4:[ {on:'kill',do:[{stack:'momentum',add:1,if:{window:'bmk'}},{stack:'momentum',touch:true},{window:'bmk',dur:4}]},   // Blood Momentum
             {stat:{aspd:R(0.03)},per:'momentum'} ],
    rh_4_1:[ {stat:{crit:R(0.02)},if:{targetHas:'quarry'}} ],                               // Hunter's Read
    rh_4_2:[ {on:'hit',if:{window:'bloodthirst',targetDot:'bleed'},do:[{heal:{pct:R(0.10),of:'lifesteal'}}]} ],   // Salt the Wound
    rh_5_1:[ {on:'kit',skill:'warcry',opt:{mul:{bonus:R(0.03)},mulPerLv:{mul:R(0.03,1)}}} ],   // Warpath
    rh_5_4:[ {param:'momentum.dur',add:R(1)} ],                                             // Long Hunger
    rh_6_1:[ {on:'kill',if:{targetHas:'quarry'},do:[{stack:'trophy',add:1}]},               // Trophy
             {stat:{atk:R(0.015)},per:'trophy'} ],
    rh_6_2:[ {param:'bleed.dur',add:R(0.3)} ],                                              // Deep Cuts
    rh_7_1:[ {on:'hit',if:{auto:true},do:[{dmg:{pct:R(0.08),of:'hit'},on:{team:'enemy',of:'target',within:2,n:1,skip:'target'}}]} ],   // Cleaving Blows (reading: "beside" = within 2 m of the target)
    rh_10_1:[ {on:'tick',do:[{slow:R(0.05),dur:0.2,on:{team:'enemy',has:'quarry',hpBelow:0.5}}]} ],   // No Escape
    rh_7_4:[ {on:'in',more:R(0.01)}, {on:'out',more:R(0.02)} ],                              // Reckless
    rh_8_1:[ {on:'out',if:{targetHas:'quarry'},more:R(0.01),per:{markAge:'quarry',every:3,max:5}} ],   // Long Hunt
    rh_5_3:[ {on:'cast',skill:'warcry',do:[{mark:'exec',on:{team:'enemy',of:'self',withinOpt:'radius',hpBelow:0.30}}]},   // Execution Hour (reading: enemies inside Warcry's range)
             {on:'out',if:{targetHas:'exec'},more:0.40,do:[{mark:'exec',clear:true}]} ],
    rh_8_3:[ {stat:{aspd:R(0.03)},if:{selfHpBelow:0.40}} ],                                 // Adrenaline
    rh_9_3:[ {on:'out',if:{targetDot:'bleed'},critMore:R(0.03)} ],                          // Grim Focus
    rh_9_2:[ {on:'teamIn',if:{targetTeam:'enemy',targetDot:'bleed'},more:R(0.015)} ],       // Everything Bleeds (team-wide)
    rh_6_3:[ {on:'tick',do:[{slow:R(0.10),dur:0.2,on:{team:'enemy',has:'exec'}}]} ],        // Hobble
    rh_9_4:[ {on:'kill',if:{stackMin:{momentum:3}},do:[{cd:'blue',set:0}]} ],               // The Work Never Ends
    rh_10_3:[ {on:'hit',if:{crit:true},do:[{cd:'green',add:R(-0.1)}]} ],                    // Butcher's Rhythm
    rh_10_4:[ {param:'spill',add:R(0.06)} ],                                                // Overflow
    rh_11_1:[ {on:'kill',do:[{heal:{pct:R(0.01),of:'maxHp'}}]} ],                           // Taste for It
    rh_11_2:[ {on:'death',if:{who:'enemy'},do:[{jumpDots:'bleed',from:'unit',to:{team:'enemy',of:'unit',n:1}}]} ],   // Bloodletter
    rh_11_4:[ {on:'out',if:{selfHpAbove:0.80},critMore:R(0.04)} ],                          // Glass Edge
    rh_12_1:[ {stat:{lifesteal:R(0.01)},per:'trophy'} ],                                    // Head on the Wall
    rh_12_2:[ {stat:{atk:R(0.01)},per:{dots:'bleed',max:5}} ],                              // Blood in the Air (reading: his own bleeds)
    rh_12_3:[ {on:'out',once:'wave',critMore:R(0.10)} ],                                    // Killer's Calm: his first hit each wave, if it is a critical
    rh_12_4:[ {on:'lethal',once:'fight',do:[{undying:R(0.5)}]} ],                           // Last Breath
    rh_13_2:[ {on:'kill',if:{window:'harvest'},do:[{window:'harvest',add:1}]},              // The Last Harvest (SIGNATURE): each kill during it adds 1 s
              {on:'kill',if:{targetHas:'quarry'},do:[{window:'harvest',dur:6,cd:25}]},      //   killing the Quarry starts it (6 s, cooldown 25 s)
              {on:'death',pts:['red_harvest',91],if:{unitHas:'quarry'},do:[{window:'harvest',dur:6,cd:25}]},   //   AT 91 POINTS: the Quarry dying to anything starts it
              {on:'crit',if:{window:'harvest'},force:true},                                 //   every hit is a guaranteed critical
              {on:'hit',if:{window:'harvest',crit:true},do:[{dot:'bleed',on:{team:'enemy',of:'target',within:3,skip:'target'},amt:{pct:{rk:'rh_2_2',r:0.04},of:'hit'},dur:P('bleed.dur',3),every:1,color:BLEED}]} ],   //   ...that spreads Open Wounds (at Open Wounds' own rank) within 3 m

    /* ============================== IRONBLOOD ============================== */
    ib_1_1:[ {on:'hit',do:[{stack:'temper',add:1}]},                                        // Forge Heat
             {on:'in',less:R(0.001),per:'temper'} ],
    ib_n1:[  {on:'dotIn',less:R(0.05)} ],                                                   // Seared Shut
    ib_1_4:[ {on:'hurt',if:{srcMelee:true},do:[{dmg:{pct:R(0.02),of:'armor'},on:'source',emit:'retal'}]} ],   // Spiked Mail: Retaliation
    ib_2_1:[ {on:'in',if:{hitMin:{pct:0.10,of:'maxHp'},stackMin:{temper:[7,6,5]}},mul:0.5,do:[{stack:'temper',spend:[7,6,5]}]} ],   // Quench
    ib_2_2:[ {on:'heal',if:{overMin:0},do:[{stack:'bank',add:{pct:R(0.08),of:'over'}}]} ],  // Blood Bank
    ib_4_2:[ {on:'tick',unless:'ib_5_3',edge:true,if:{selfHpBelow:0.40},do:[{stack:'bank',spend:'all',then:[{heal:{pct:{r:0.10,b:1,$:'payout'},of:'spent'}},{emit:'payout'}]}]},   // Withdrawal
             {on:'tick',req:'ib_5_3',edge:true,if:{selfHpBelow:0.40},do:[{stack:'bank',spend:'all',then:[{heal:{pct:{r:0.10,b:1,$:'payout'},of:'spent'},on:{team:'ally',others:true,order:'lowHp',n:1}},{emit:'payout'}]}]} ],   // ...paid to the lowest-HP ally with Share the Wealth
    ib_3_4:[ {on:'hurt',do:[{fn:'grudge'}]},                                                // Grudge
             {on:'out',if:{targetHas:'grudge'},more:R(0.02)} ],
    ib_5_2:[ {on:'hit',if:{window:'bloodthirst',stackEmpty:'bank'},do:[{heal:{pct:1,of:'lifesteal'}}]} ],   // Investment
    ib_5_3:[ {param:'share',add:1} ],                                                       // Share the Wealth (its effect is the second Withdrawal row)
    ib_5_4:[ {on:'hurt',do:[{stack:'cb',add:1,full:[{stack:'cb',set:0},{window:'counter',dur:600}]}]},   // Counterblow
             {on:'out',if:{auto:true,window:'counter'},more:R(0.10),do:[{window:'counter',end:true}]} ],
    ib_6_1:[ {stat:{atk:R(0.001)},per:'temper'} ],                                          // Hammered Steel
    ib_6_2:[ {param:'bank.max',add:R(0.02)} ],                                              // Blood Reserve
    ib_6_4:[ {on:'hit',if:{targetHas:'grudge'},do:[{heal:{pct:R(0.01),of:'hpLost'}}]} ],    // Bad Blood
    ib_7_2:[ {on:'kit',skill:'laststand',opt:{mul:{set:1},mulPerLv:{set:0}}},               // Sanguine Hide: no damage reduction...
             {on:'cast',skill:'laststand',do:[{stack:'bank',spend:'all',then:[{shield:{pct:2,of:'spent'},dur:{opt:'dur',d:5}}]}]} ],   // ...the bank becomes a shield of twice its size (reading: for Last Stand's duration)
    ib_7_3:[ {on:'hit',do:[{slow:R(0.02),dur:1}]} ],                                        // Weight of Iron
    ib_7_4:[ {on:'hurt',do:[{roll:'pain',add:{pct:1,of:'hpLost'},span:3},{window:'pain',dur:4,count:{roll:'pain',step:{pct:0.10,of:'maxHp'}},min:1,most:true}]},   // Pain into Power
             {stat:{atk:R(0.01)},per:{window:'pain'}} ],
    ib_8_1:[ {on:'hurt',if:{stackMin:{temper:15}},do:[{dot:'burn',on:'source',amt:{pct:R(0.005),of:'maxHp'},total:true,dur:2,every:0.5,color:BURN,refresh:true}]} ],   // Slag
    ib_9_2:[ {stat:{atk:R(0.02)},if:{stackFull:'bank'}} ],                                  // Blood Money
    ib_9_4:[ {on:'kill',if:{targetHas:'grudge'},do:[{heal:{pct:0.10,of:'maxHp'}},{window:'settled',dur:2}]},   // Settle the Score
             {on:'in',if:{window:'settled'},less:0.30} ],
    ib_10_1:[ {on:'cast',skill:'laststand',do:[{stack:'temper',spend:'all',then:[{heal:{pct:R(0.005),of:'maxHp',x:'spent'}}]}]} ],   // Cooling Hiss
    ib_10_3:[ {on:'in',if:{selfHpBelow:0.30},less:R(0.02)} ],                               // Unyielding
    ib_10_4:[ {on:'hurt',if:{srcMelee:false},do:[{dmg:{pct:{rk:'ib_1_4',r:0.02},of:'armor'},scale:R(0.10),on:'source',emit:'retal'}]} ],   // Iron Thorns
    ib_11_1:[ {stat:{crit:R(0.0005)},per:'temper'} ],                                       // Tempered Edge
    ib_11_4:[ {on:'out',if:{targetHas:'oldgrudge'},more:{rk:'ib_3_4',r:0.02},scale:R(0.20)} ],   // Old Grudges (reading: he keeps part of the bonus against the enemy that WAS his Grudge)
    ib_12_1:[ {on:'wave',do:[{stack:'temper',atLeast:R(5)}]} ],                             // Forgeborn
    ib_12_2:[ {param:'payout',add:R(0.04)}, {on:'payout',do:[{cleanse:1}]} ],               // Golden Vein (reading: the control effect is removed from Vael)
    ib_12_4:[ {on:'retal',do:[{heal:{pct:R(0.05),of:'spent'}}]} ],                          // Debt Paid
    ib_13_2:[ {on:'tick',edge:true,once:'fight',if:{selfHpBelow:0.30},do:[{window:'heart',dur:8},{stack:'bank',spend:'all',then:[{shield:{pct:1,of:'spent'},dur:8}]}]},   // Heart of Iron (SIGNATURE). PARTIAL: what a Temper is worth as shield is not written
              {on:'hit',if:{auto:true,window:'heart'},do:[{dmg:{pct:1,of:'hit'},on:{team:'enemy',of:'self',within:3,skip:'target'}}]},   //   his attacks hit every enemy within 3 m
              {on:'hurt',if:{window:'heart'},do:[{stack:'temper',add:1}]},                  //   every hit he takes gives Temper
              {on:'end:heart',pts:['ironblood',91],do:[{stack:'bank',add:{pct:1,of:'shield'}},{unshield:1}]} ],   //   AT 91 POINTS: what is left of the shield flows back into the bank

    /* ============================== THE ASHFORD WALL ============================== */
    aw_1_1:[ {on:'hurt',if:{lostMin:{pct:R(-0.01,0.14),of:'maxHp'}},do:[{stack:'scars',add:1}]} ],   // First Scar
    aw_1_3:[ {on:'in',if:{auto:true},chance:R(0.03),less:0.35,do:[{emit:'block'}]} ],       // Shield Arm: Block (the one seeded roll among his talents)
    aw_2_1:[ {stat:{armor:R(0.003),mr:R(0.003)},per:'scars'} ],                             // Hard Lessons
    aw_2_2:[ {on:'tick',if:{moved:true,noWindow:'planted'},do:[{stack:'footing',set:0}]},   // Footing: moving clears it...
             {on:'tick',if:{moved:false},period:1,rate:P('footing.rate',1),do:[{stack:'footing',add:1}]},   // ...each full second standing still adds one
             {on:'in',less:R(0.004),per:'footing'} ],
    aw_3_1:[ {on:'cast',skill:'laststand',do:[{stack:'scars',spend:'all',then:[{heal:{pct:0.02,of:'maxHp',x:'spent'}},{emit:'scarsSpent'}]}]} ],   // Reopened Wounds
    aw_4_2:[ {on:'hurt',if:{stackMin:{footing:5}},do:[{slow:R(0.03),dur:2,on:'source'}]} ], // Rooted Stance
    aw_2_3:[ {on:'block',do:[{heal:{pct:R(0.004),of:'maxHp'}}]} ],                          // Turned Aside
    aw_3_4:[ {on:'ccIn',less:R(0.04)} ],                                                    // Tenacity
    aw_4_1:[ {on:'scarsSpent',do:[{shield:{pct:R(0.006),of:'maxHp',x:'spent'},dur:4}]} ],   // Scar Tissue
    aw_3_3:[ {param:'scars.max',add:R(2)} ],                                                // Deep Scars
    aw_4_3:[ {on:'hurt',do:[{mark:'hitme',on:'source',dur:2}]},                             // Bitter Ash
             {on:'hit',if:{window:'bloodthirst',targetHas:'hitme'},do:[{heal:{pct:R(0.07),of:'lifesteal'}}]} ],
    aw_4_4:[ {on:'wave',do:[{mark:'oath',on:{team:'ally',others:true,order:'lowHp',n:1},unique:true}]},   // Bound by Oath
             {on:'teamIn',if:{targetHas:'oath',srcTeam:'enemy'},divert:R(0.04)} ],
    aw_5_1:[ {on:'death',if:{who:'ally'},do:[{stack:'scars',add:R(2)}]} ],                  // Grim Memory
    aw_5_2:[ {on:'cast',skill:'warcry',do:[{window:'planted',dur:2},{stack:'footing',set:'max'}]},   // Plant Your Feet: rooted = cannot walk, can still attack
             {stat:{move:-1},if:{window:'planted'}} ],
    aw_5_4:[ {on:'diverted',do:[{stack:'ledger',add:{pct:1,of:'spent'}}]},                  // Oath Ledger
             {on:'cast',skill:'laststand',do:[{stack:'ledger',spend:'all',then:[{dmg:{pct:R(0.06),of:'spent'},on:AROUND(5)},{emit:'ledgerBurst'}]}]} ],
    aw_6_1:[ {stat:{atk:R(0.002)},per:'scars'} ],                                           // Callused
    aw_6_2:[ {on:'end:planted',do:[{dmg:{pct:R(0.03),of:'maxHp'},on:AROUND(3)}]} ],         // Footfall
    aw_6_4:[ {on:'death',if:{unitHas:'oath'},do:[{window:'unpaid',dur:'wave'}]},            // Unpaid Debt
             {on:'in',if:{window:'unpaid'},less:R(0.06)} ],
    aw_7_2:[ {on:'cast',skill:'laststand',do:[{stack:'footing',set:'max'}]},                // Hold the Gate. PARTIAL: "enemies that walk into him are stopped" needs a ruling
             {stat:{immovable:1},if:{window:'laststand'}} ],
    aw_8_1:[ {on:'kit',skill:'warcry',opt:{fear:{add:R(0.03),per:'scars',ccRaw:true}}} ],   // War Ledger
    aw_8_3:[ {param:'footing.rate',add:R(0.10)} ],                                          // Stubborn Ground
    aw_8_4:[ {on:'hit',if:{window:'bloodthirst'},do:[{heal:{pct:R(0.04),of:'lifesteal'},on:'holder:oath'}]} ],   // Sworn Shield
    aw_9_1:[ {on:'cast',skill:'warcry',if:{stackMin:{scars:10}},do:[{taunt:1.5,on:{team:'enemy',of:'self',withinOpt:'radius',fearedBy:true}}]} ],   // Every Scar a Name
    aw_9_2:[ {on:'hurt',if:{stackFull:'footing'},do:[{dmg:{pct:R(0.02),of:'hit'},on:'source'}]} ],   // Anvil
    aw_9_4:[ {on:'wave',do:[{mark:'oath2',on:{team:'ally',others:true,order:'lowHp',n:1,skipN:1},unique:true}]},   // Shared Burden
             {on:'teamIn',if:{targetHas:'oath2',srcTeam:'enemy'},divert:R(0.01)} ],
    aw_10_1:[ {stat:{lifesteal:R(0.003)},per:'scars',if:{selfHpBelow:0.50}} ],              // Old Wounds Ache
    aw_11_2:[ {on:'lethal',once:'fight',if:{stackMin:{scars:5}},do:[{stack:'scars',spend:'all',then:[{undying:2},{heal:{pct:0.03,of:'maxHp',x:'spent'}}]}]} ],   // Unbroken
    aw_10_3:[ {on:'ccOut',if:{stackFull:'footing',cc:['fearT','slow']},more:R(0.04)} ],     // Mountain Stance
    aw_11_1:[ {on:'scarsSpent',do:[{window:'ash',dur:4,count:'spent'}]},                    // Ash and Iron
              {stat:{armor:R(0.01)},per:{window:'ash'}} ],
    aw_11_4:[ {on:'ledgerBurst',do:[{taunt:R(0.2),on:AROUND(5)}]} ],                        // Debt Collector
    aw_12_1:[ {on:'hurt',if:{lostBelow:{pct:{rk:'aw_1_1',r:-0.01,b:0.14},of:'maxHp'}},every:R(-2,30),do:[{stack:'scars',add:1}]} ],   // Ten Thousand Cuts
    aw_12_4:[ {on:'waveEnd',if:{holderAlive:'oath'},do:[{energy:R(1)}]} ]                   // Promise Kept
  },
  /* one sentence runs, another waits for a ruling */
  partial:{
    rh_n2:'"his Temper does not fade while any enemy carries one of his bleeds": no tooltip says how Temper fades, so there is nothing to stop',
    ib_13_2:'"all his banked blood and Temper become a shield": what one Temper is worth as shield is not written; the bank part, the 3 m attacks, Temper per hit taken and the 91-point line run',
    aw_7_2:'"enemies that walk into him during Last Stand are stopped for 0.5 s": the engine has no walking-into rule; full Footing and cannot-be-moved run'
  },
  /* nothing implemented: the text cannot run against his real kit, or leaves out a number. Each one is written up for the owner. */
  ruling:{
    rh_2_3:'Blood Rage has no stacks', ib_5_1:'Blood Rage has no stacks', ib_8_3:'Blood Rage has no stacks', aw_12_3:'Blood Rage has no stacks',
    rh_4_3:'Bloodthirst deals no damage', ib_3_3:'Bloodthirst deals no damage', ib_12_3:'Bloodthirst deals no damage',
    ib_3_1:'Bloodthirst is not a strike', ib_9_3:'Bloodthirst has no target',
    rh_7_2:'Last Stand already gives 100% lifesteal: "25% lifesteal" would be a loss',
    rh_5_2:'the bleed has no size: Warcry is not a hit',
    ib_4_1:'no tooltip says how Temper fades', ib_11_2:'no tooltip says how the Blood Bank fades or that it empties between waves',
    aw_1_4:'Vael never walks toward an ally', aw_5_3:'a leap: new movement', aw_6_3:'depends on Charge the Breach',
    aw_7_1:'no lanes, no "behind"', aw_7_4:'a position swap', aw_10_4:'depends on Change of Guard',
    aw_12_2:'depends on the stop of Hold the Gate', aw_13_2:'lanes, "cannot walk past", "behind him"'
  },
  /* the few things that are not one of the generic primitives */
  fn:{
    /* Grudge: the enemy that has dealt Vael the most damage this wave holds the 'grudge' mark. With Old Grudges learned, the enemy that
       was the Grudge keeps an 'oldgrudge' mark. Called on every hit he takes. */
    grudge(A,T,u,ctx){ const src=ctx.src; if(!src||!(ctx.hpLost>0)) return; const s=T.s, g=s.g||(s.g={w:-1,by:{},top:null});
      if(g.w!==s.wave){ g.w=s.wave; g.by={}; g.top=null; }
      g.by[src.uid]=(g.by[src.uid]||0)+ctx.hpLost;
      const cur=g.top; if(cur===src) return;
      if(!cur||!cur.alive||g.by[src.uid]>(g.by[cur.uid]||0)){ if(cur&&cur.alive&&T.r.ib_11_4) A.setMark(T,u,cur,'oldgrudge',{}); A.clearMark(u,src,'oldgrudge'); A.setMark(T,u,src,'grudge',{unique:true}); g.top=src; } }
  }
};

return module.exports;})();
  MECH["vex"]=(function(){const module={exports:{}};
/* VEX - what her learned talents do in a fight (the mechanics; her 10 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md (section 13: what Vex added)
   Her real kit (the code, not the tooltip wording):
   - Hookline ('hookline', green, cd 8): picks its mark - the lowest-max-HP back-row Mage within 28 m (o.range, centre to centre), else the lowest-max-HP
     enemy in reach - throws the rope and reels her in (an air dash of about 0.73 s, rooted). When she lands BEHIND the mark: one strike of
     attack x o.mul (160%) x o.crit (1.5, a flat multiplier: the strike still rolls its own crit like any hit), then she cannot be targeted for o.evade (0.5 s).
     Page hooks: skillTgt (the mark, the options), landPre (the strike is Hookline's: casting 'hookline'), land (she has landed behind it).
   - Bleed Them Dry ('dot', blue, cd 9): 120% attack up front, then a bleed (#c0392b, physical: armor applies to each tick) of 30% attack a second for 6 s.
   - Razor Tempest ('triplecleave', ult): three cuts of 80% attack on every enemy in a 45-degree wedge 10 m deep, all at once (only the rings are
     staggered), and a 3 s bleed of 12% attack a second on each enemy struck.
   - Killer Instinct (passive): at each basic attack's SWING (before the blow lands, hit or miss) the target's wound timer (mortalT, the game's one
     "half healing" timer that other effects also use) is raised to 3 s x her passive's level multiplier. Page hooks passPre / pass.
   - Her basic attacks and skills are physical. She has no dodge of her own: the game's Evasion stat (glyphs) is a separate MISS roll.
   "Her bleeds" = the DoTs of her skills (tagged hers at the cast) and of her talents. "Killer Instinct on an enemy" = her mark 'ki', set with the wound.
   Talents whose text cannot run against that kit are NOT guessed at: they are written up for the owner in WIRING/07 - VEX - talents that need a ruling.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const RED='#c0392b';
const KIDUR={pct:P('ki.dur',3),of:'passMul'};                                    // Killer Instinct's wound: 3 s x her passive's level (Ragged Edges: 5 s)
const KI_TAL=[{timer:'mortalT',on:'target',min:KIDUR,if:{np:'cc'}},{mark:'ki',on:'target',dur:KIDUR},{ustack:'dw',on:'target',touch:true}];   // a talent that "applies Killer Instinct"
const KIC={unitHas:'ki',unitMin:{mortalT:1e-9},np:'cc'};                         // a heal on an enemy whose healing her Killer Instinct is cutting now
const ME='self', HK={skill:'hookline'};
const BURST={team:'enemy',of:'target',within:3};                                  // the target and every enemy within 3 m of it (body to body)
module.exports={
  hero:'vex',
  casting:true,                         // rows ask which of her skills a hit comes from (Hookline's strike, Razor Tempest's cuts)
  states:{
    coil:{max:6,wave:'reset'}, ck:{}, hkSp:{}, ff:{}, hang:{max:5}, chn:{max:3}, ag3:{max:3},
    dw:{unit:true,max:{b:5,$:'dw.max'},dur:KIDUR,longest:true},                  // Deep Wounds, on each enemy: lapse with the wound
    drip:{max:20,fade:{after:P('drip.wait',0),every:1,lose:1,unless:{anyDot:true}}},
    den:{max:{pct:{b:3,$m:'den.more'},of:'dmg'}}, denF:{},                        // Denied: full at 3 x her Attack stat
    lp:{max:1,start:'max'},                                                        // Lockpick: ready, or recharging
    patter:{max:10,wave:'reset'}, so:{max:3,wave:'reset'}
  },
  /* needs: a talent that improves a mechanic does nothing without the talent that introduces it */
  needs:{ rw_3_1:'rw_1_1', rw_4_1:'rw_1_1', rw_6_1:'rw_1_1', rw_8_1:'rw_1_1', rw_9_1:'rw_1_1', rw_12_1:'rw_1_1',
          rw_3_4:'rw_1_4', rw_5_4:'rw_1_4', rw_9_4:'rw_1_4', rw_10_4:'rw_1_4', rw_12_4:'rw_1_4',
          rw_4_2:'rw_2_2', rw_8_3:'rw_2_2', rw_8_2:'rw_2_2', rw_6_2:'rw_2_2', rw_5_2:'rw_2_2', rw_5_3:'rw_2_2', rw_10_2:'rw_2_2', rw_11_2:'rw_2_2', rw_12_2:'rw_2_2', rw_6_3:'rw_5_3',
          sc_2_1:'sc_1_1', sc_4_1:'sc_1_1', sc_6_1:'sc_1_1', sc_8_1:'sc_1_1', sc_12_1:'sc_1_1',
          sc_3_4:'sc_1_4', sc_5_4:'sc_1_4', sc_6_4:'sc_1_4', sc_7_4:'sc_1_4', sc_9_4:'sc_1_4', sc_10_1:'sc_1_4', sc_12_4:'sc_1_4', sc_10_4:'sc_9_4',
          sc_4_2:'sc_2_2', sc_6_2:'sc_2_2', sc_9_2:'sc_2_2', sc_10_2:'sc_2_2', sc_11_2:'sc_2_2', sc_12_2:'sc_2_2', sc_13_2:'sc_2_2', sc_6_3:'sc_5_3',
          sl_2_1:'sl_1_1', sl_3_1:'sl_1_1', sl_4_1:'sl_1_1', sl_7_1:'sl_1_1', sl_8_1:'sl_1_1', sl_10_1:'sl_1_1', sl_11_1:'sl_1_1',
          sl_4_2:'sl_1_2', sl_7_3:'sl_1_2', sl_8_2:'sl_1_2', sl_12_2:'sl_1_2',
          sl_3_4:'sl_1_4', sl_5_4:'sl_1_4', sl_6_4:'sl_1_4', sl_7_4:'sl_1_4', sl_9_3:'sl_1_4', sl_9_4:'sl_1_4', sl_11_4:'sl_1_4', sl_12_4:'sl_1_4', sl_n3:'sl_1_4',
          sl_6_2:'sl_5_2', sl_6_3:'sl_5_3' },
  /* run for her whenever she has any mechanic talent: her skills' bleeds made hers, Killer Instinct's wound as her mark; Denied's bookkeeping when learned */
  always:[
    {on:'kit',skill:'dot',do:[{tagDots:'kit'}]}, {on:'cast',skill:'dot',do:[{tagDots:'btd',exact:true,emit:'bleedOn'}]},
    {on:'kit',skill:'triplecleave',do:[{tagDots:'kit'}]}, {on:'cast',skill:'triplecleave',do:[{tagDots:'rt',emit:'bleedOn'}]},
    {on:'pass',do:[{emit:'swing'},{mark:'ki',on:'target',dur:KIDUR},{timer:'mortalT',on:'target',min:KIDUR,if:{np:'cc'}},{restore:'mortalT',on:'target',if:{p:'cc'}},{ustack:'dw',on:'target',touch:true}]},
    {on:'teamHeal',req:'sc_2_1',if:Object.assign({unitUst:{dw:5},p:'fest'},KIC),less:P('fest',0)},          // Festering: at 5 Deep Wounds the wound cuts more
    {on:'teamHeal',req:'sc_2_2',if:KIC,do:[{stack:'den',add:{pct:P('den',0),of:'a0'}},{stack:'den',add:{pct:P('den',0),of:'cut'}}]}   // Denied: a share of what the wound stopped
  ],
  talents:{
    /* ============================== THE ROPEWALKER ============================== */
    rw_1_1:[ {on:'hit',if:{auto:true},do:[{stack:'coil',add:1}]},                                    // Coiled Rope: a Coil per basic attack that lands
             {on:'skillAt',skill:'hookline',opt:{mul:{more:R(0.01),per:'coil'}},do:[{stack:'hkSp',set:{stack:'coil'}},{stack:'coil',spend:'all'}]} ],   //   Hookline spends them all
    rw_2_3:[ {stat:{move:R(0.03)}} ],                                                                 // Light Feet
    rw_1_4:[ {on:'land',skill:'hookline',do:[{mark:'blind',on:'target',dur:P('blind.dur',3)}]},       // Blindside: 3 s after she lands behind it
             {on:'out',if:{targetHas:'blind'},more:R(0.04)} ],
    rw_2_1:[ {on:'kit',skill:'hookline',opt:{range:{addM:R(1)}}} ],                                  // Long Throw
    rw_2_2:[ {on:'land',skill:'hookline',if:{targetAlive:true},do:[{emit:'snagLand',amt:P('snag.dur',2)}]},   // Snag: Hookline's mark, 2 s
             {on:'snagLand',do:[{mark:'snag',on:'target',dur:{pct:1,of:'hit'},longest:true},{emit:'snagOn'}]},
             {stat:{move:-1},to:{team:'enemy',has:'snag'}},                      //   it cannot move
             {on:'out',if:{targetHas:'snag'},more:R(0.02)} ],                                         //   and takes more from her
    rw_3_1:[ {on:'kit',skill:'hookline',do:[{stack:'hkSp',set:0}]}, {on:'cd',skill:'green',if:{stackMin:{hkSp:6}},add:-2} ],   // Hand over Hand
    rw_3_3:[ {on:'out',if:{any:[{casting:'hookline'},{targetHas:'blind'}]},ignoreArmor:R(0.03)} ],    // Through the Gap
    rw_3_4:[ {stat:{crit:R(0.03)},if:{targetHas:'blind'}} ],                                          // Knife in the Dark (her attacks on a Blindsided target)
    rw_4_1:[ {on:'hit',if:{auto:true},chance:R(0.10),do:[{stack:'coil',add:1}]} ],                    // Rope-Works Hands
    rw_4_2:[ {param:'snag.dur',add:R(0.3)} ],                                                         // Tight Line
    rw_4_3:[ {on:'kit',skill:'hookline',opt:{mul:{more:R(0.05)}}} ],                                  // Hook Edge
    rw_8_3:[ {on:'out',if:{targetHas:'snag'},critMore:R(0.04)} ],                                     // Ruthless
    rw_5_1:[ {on:'ccIn',less:R(0.04)} ],                                                              // Rolls With It
    rw_8_2:[ {on:'teamIn',if:{srcHas:'snag',srcTeam:'enemy'},less:R(0.02)}, {on:'in',if:{srcHas:'snag'},less:R(0.02)} ],   // Strangle Knot
    rw_5_4:[ {param:'blind.dur',add:R(0.3)} ],                                                        // Shadow Step
    rw_6_1:[ {on:'wave',do:[{stack:'coil',atLeast:R(1)}]} ],                                          // Slack Line
    rw_6_2:[ {on:'teamIn',if:{targetHas:'snag',srcTeam:'ally'},more:R(0.015)} ],                      // Gallows Knot (her whole team, her own hits too)
    rw_6_4:[ {on:'land',skill:'hookline',do:[{window:'ots',dur:99}]}, {on:'out',if:{window:'ots'},critMore:R(0.08),do:[{window:'ots',end:true}]} ],   // Over the Shoulder
    rw_7_1:[ {on:'out',if:{targetRow:'Back'},more:R(0.02)} ],                                         // Fragile Things
    rw_11_3:[ {on:'land',skill:'hookline',do:[{window:'qe',dur:2}]}, {on:'in',if:{window:'qe'},less:R(0.02)} ],   // Quick Exit
    rw_7_3:[ {on:'kit',skill:'triplecleave',opt:{mul:{more:R(0.03)}}} ],                              // Wide Arc
    rw_8_1:[ {stat:{aspd:R(0.003)},per:'coil'} ],                                                     // Dead Weight
    rw_5_2:[ {on:'snagOn',do:[{silence:{left:'snag',of:'target'},on:'target'}]} ],                    // Held Snag: silenced until the Snag ends
    rw_5_3:[ {on:'death',if:{unitHas:'snag'},do:[{cd:'green',mul:0.5},{emit:'cutLoose'}]} ],          // Cut Loose
    rw_7_4:[ {on:'kit',skill:'hookline',opt:{evade:{add:R(0.1)}}} ],                                  // Ghost Line
    rw_9_1:[ {on:'out',if:{auto:true,stackFull:'coil'},more:R(0.03)} ],                               // Coil Snap
    rw_9_3:[ {on:'out',if:{targetHpBelow:0.30},more:R(0.03)} ],                                       // Open Throat
    rw_6_3:[ {on:'cutLoose',do:[{window:'fr',dur:4}]}, {stat:{aspd:R(0.05)},if:{window:'fr'}} ],      // Free Run
    rw_9_4:[ {on:'kill',do:[{mark:'blind',on:{team:'enemy',n:1},dur:P('blind.dur',3)}]} ],           // Second Shadow (reading: no movement)
    rw_10_1:[ {on:'skillAt',skill:'hookline',do:[{dmg:{pct:R(0.05),of:'atk'},on:{team:'enemy',seg:true,within:0,skip:'target'},tag:'rope'}]} ],   // Rope Burn (reading: the straight rope)
    rw_10_2:[ {on:'snagLand',if:{targetHpBelow:0.50},add:R(0.2)} ],                                   // Noose
    rw_10_4:[ {on:'hit',if:{targetHas:'blind'},do:[{heal:{pct:R(0.02),of:'hpLost'},on:ME}]} ],        // Unseen
    rw_11_1:[ {on:'skillAt',skill:'hookline',do:[{stack:'ff',set:{pct:1,of:'gap'}}]},                 // Fifteen Feet: metres to the mark as it fires
              {on:'out',if:{casting:'hookline'},more:R(0.01),per:{stack:'ff',div:3,max:3}} ],
    rw_11_2:[ {on:'death',if:{unitHas:'snag'},do:[{mark:'snag',on:{team:'enemy',of:'unit',n:1},dur:{left:'snag',of:'unit'},longest:true},{emit:'snagOn',on:{team:'enemy',of:'unit',n:1}}]} ],   // Hanging Weight
    rw_12_1:[ {on:'waveEnd',do:[{stack:'ck',set:{stack:'coil',max:R(2)}}]}, {on:'wave',do:[{stack:'coil',atLeast:{stack:'ck'}}]} ],   // Rope Memory
    rw_12_2:[ {on:'snagLand',do:[{stack:'hang',add:1}]}, {stat:{atk:R(0.01)},per:'hang'} ],           // Hangman's Count
    rw_12_3:[ {on:'out',if:{any:[{targetHas:'snag'},{targetHas:'blind'}]},critMore:R(0.02)} ],        // Last Look
    rw_12_4:[ {on:'hit',if:{targetHas:'blind'},do:[{cd:'green',add:R(-0.2)}]} ],                      // Closing the Distance
    rw_13_2:[ {on:'landPre',skill:'hookline',do:[{mark:'hooked',on:'target',dur:4,ends:'hookEnd'}]},  // Nobody Picks the Distance (SIGNATURE)
              {on:'death',if:{unitHas:'hooked',noWindow:'chainLock'},do:[{mark:'hooked',on:'unit',clear:true},{cd:'green',set:0},{window:'chainNext',dur:99}]},   //   the mark dies within 4 s: ready at once
              {on:'hookEnd',if:{noWindow:'chainNext'},do:[{stack:'chn',set:0}]},                     //   it lived: the chain is broken
              {on:'kit',skill:'hookline',do:[{window:'chainHit',end:true}]},
              {on:'kit',skill:'hookline',if:{window:'chainNext'},do:[{window:'chainNext',end:true},{window:'chainHit',dur:99},{stack:'chn',add:1,full:[{window:'chainLock',dur:20},{stack:'chn',set:0}]}]},
              {on:'out',if:{window:'chainHit',casting:'hookline'},more:0.20},                         //   each chained hook 20% more; 3, then 20 s
              {on:'land',skill:'hookline',do:[{window:'chainHit',end:true}]} ],

    /* ============================== THE SLOW CUT ============================== */
    sc_1_1:[ {on:'swing',if:{targetHas:'ki'},do:[{ustack:'dw',on:'target',add:1}]},                  // Worrying the Cut: a swing on an enemy already wounded
             {on:'out',if:{targetUst:{dw:1}},more:R(0.004),per:{ust:'dw',of:'target'}} ],
    sc_2_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                    // Steady Hands
    sc_1_4:[ {on:'dotTick',icd:0.9,do:[{stack:'drip',add:1}]}, {stat:{aspd:R(0.001)},per:'drip'} ],  // Drip: each second one of her bleeds ticks
    sc_2_1:[ {param:'fest',add:R(0.10)} ],                                                            // Festering (the always row: 5% of the heal = 10% of what is left)
    sc_2_2:[ {param:'den',add:R(0.10)},                                                               // Denied (stored by the always row)
             {on:'cast',skill:'dot',do:[{stack:'denF',set:1,if:{stackFull:'den'}},{stack:'den',spend:'all',then:[{dotAdd:true,total:{pct:1,of:'spent'}},{emit:'denSpent'}]},{stack:'denF',set:0}]},
             {on:'waveEnd',if:{np:'den.keep'},do:[{stack:'den',set:0}]} ],
    sc_3_1:[ {param:'ki.dur',add:2} ],                                                                // Ragged Edges
    sc_3_3:[ {on:'kit',skill:'dot',opt:{mul:{more:R(0.03)},dps:{more:R(0.03)}}} ],                    // Serrated
    sc_3_4:[ {param:'drip.wait',add:R(0.4)} ],                                                        // Slow Pour
    sc_4_1:[ {stat:{crit:R(0.002)},per:{ust:'dw',of:'target'}} ],                                     // Open Again (her attacks on the enemy she is attacking)
    sc_4_2:[ {param:'den.more',add:R(0.2)} ],                                                         // Spite
    sc_4_3:[ {stat:{move:R(-0.03)},if:{anyDot:true},to:{team:'enemy',dot:true}} ],                                     // Thin Blood
    sc_5_1:[ {on:'kit',skill:'dot',opt:{dur:{add:R(0.4)}}} ],                                         // Long Bleed
    sc_5_3:[ {param:'cc',add:1}, {param:'cc.more',add:0.12}, {on:'out',if:{targetHas:'ki'},more:P('cc.more',0)} ],   // Clean Cut
    sc_5_4:[ {on:'dotOut',if:{stackMin:{drip:10}},more:R(0.03)} ],                                    // Pooling
    sc_6_1:[ {stat:{atk:R(-0.003)},per:{ust:'dw',of:'target'},to:{team:'enemy',ust:{dw:1}}} ],        // Weeping        // Weeping
    sc_6_2:[ {on:'denSpent',do:[{heal:{pct:R(0.04),of:'spent'},on:ME}]} ],                            // Bitter Draught
    sc_6_3:[ {param:'cc.more',add:R(0.03)} ],                                                         // Bare Bone
    sc_6_4:[ {stat:{atk:R(0.0015)},per:'drip'} ],                                                     // Red Hands
    sc_7_1:[ {on:'hit',if:{casting:'hookline'},do:KI_TAL.concat([{ustack:'dw',on:'target',add:R(1)}])} ],   // Hooked Wound
    sc_7_2:[ {on:'hit',if:{casting:'triplecleave'},do:KI_TAL.concat([{ustack:'dw',on:'target',add:1}])} ],  // Tempest of Wounds: each cut
    sc_7_3:[ {on:'kit',skill:'triplecleave',opt:{mul:{more:R(0.03)}}} ],                              // Wide Cuts
    sc_7_4:[ {on:'kit',skill:'dot',if:{stackFull:'drip'},opt:{mul:{more:R(0.05)},dps:{more:R(0.05)}},do:[{stack:'drip',spend:10}]} ],   // Patient Knife
    sc_8_1:[ {on:'teamHeal',if:{unitUst:{dw:1}},less:R(0.01),per:{ust:'dw',of:'unit'}} ],             // Nowhere to Mend
    sc_8_3:[ {on:'dotOut',if:{targetHpBelow:0.50},more:R(0.03)} ],                                    // Exsanguinate
    sc_9_2:[ {on:'dotTick',do:[{stack:'den',add:{pct:R(0.03),of:'hit'}}]} ],                          // Hoarded Spite
    sc_9_4:[ {on:'bleedOn',if:{stackFull:'drip'},do:[{copyDot:'flood',on:{team:'enemy',of:'target',n:1,skip:'target'},scale:{b:0.5,$m:'flood.more'}}]} ],   // Flood
    sc_10_1:[ {on:'death',if:{unitDot:true},do:[{stack:'drip',add:R(1)}]} ],                          // Bled Out
    sc_10_2:[ {on:'denSpent',do:[{mark:'nohl',on:'target',dur:R(0.5),longest:true}]}, {on:'teamHeal',if:{unitHas:'nohl'},mul:0} ],   // Spiteful
    sc_10_4:[ {param:'flood.more',add:R(0.06)} ],                                                     // Overflowing
    sc_11_1:[ {on:'dotTick',do:[{heal:{pct:R(0.01),of:'hit'},on:ME}]} ],                              // Leech the Cut
    sc_11_2:[ {param:'den.keep',add:1} ],                                                             // Bad Debt
    sc_11_3:[ {on:'dotTick',do:[{cd:'green',add:R(-0.05)}]} ],                                        // Quick Cuts
    sc_12_1:[ {param:'dw.max',add:R(1)} ],                                                            // Bone Deep
    sc_12_2:[ {stat:{atk:R(0.002)},per:{stack:'den',frac:10}} ],                                      // Dry to the Bone
    sc_12_3:[ {on:'dotOut',more:R(0.03)} ],                                                           // Steady Drain
    sc_12_4:[ {on:'hit',if:{casting:'triplecleave',stackFull:'drip'},do:[{dot:'rain',on:'target',amt:{pct:R(0.10),of:'hit'},total:true,dur:3,every:1,color:RED,emitDot:'bleedOn'}]} ],   // Red Rain
    sc_13_2:[ {on:'denSpent',icd:20,if:{stackMin:{denF:1}},do:[{burstDot:true,on:BURST,color:RED,tag:'burst'},{ustack:'dw',on:BURST,set:'max'},{mark:'nohl',on:BURST,dur:4,longest:true}]},   // Every Last Drop (SIGNATURE)
              {on:'teamHeal',if:{unitHas:'nohl'},mul:0} ],

    /* ============================== THE SHORT LIST ============================== */
    sl_1_1:[ {on:'tick',if:{stackEmpty:'lp'},period:R(-1,20),rateUp:[{add:P('lp.fast',0),if:{selfHpBelow:0.50}}],do:[{stack:'lp',add:1}]},   // Picked Lock: 20 - 1 s a rank
             {on:'ccIn',if:{cc:['stunned','fearT'],stackMin:{lp:1}},mul:0,do:[{stack:'lp',spend:1,then:[{emit:'lockpick'}]}]} ],
    sl_1_2:[ {on:'dodge',unless:'sl_5_3',chance:{field:'_talDodge',of:'self'},do:[{dodge:true}]}, {stat:{dodge:R(0.02)}} ],   // Slip Aside (Feint)
    sl_1_4:[ {on:'aimed',do:[{mark:'sl',on:'source',dur:P('sl.dur',6),cap:{b:2,$:'sl.n'},added:'slAdd',longest:true}]},   // Short List
             {on:'out',if:{targetHas:'sl'},more:R(0.02)} ],
    sl_2_1:[ {on:'lockpick',do:[{window:'lf',dur:3}]}, {stat:{move:R(0.05)},if:{window:'lf'}} ],     // Light Fingers
    sl_2_2:[ {on:'dodged',do:[{window:'qs',dur:3}]}, {stat:{aspd:R(0.03)},if:{window:'qs'}} ],       // Quick Study
    sl_3_1:[ {on:'lockpick',do:[{window:'rc',dur:99}]}, {on:'crit',if:{window:'rc'},force:true,do:[{window:'rc',end:true}]} ],   // Rain Check
    sl_4_2:[ {stat:{dodge:R(0.01)}} ],                                                                // Sidestep
    sl_n3:[  {on:'slAdd',do:[{mark:'stn',on:'target'}]}, {on:'out',if:{targetHas:'stn'},more:0.10,do:[{mark:'stn',on:'target',clear:true}]},   // Struck Through (LINK)
             {on:'hit',req:'sc_1_1',if:{targetHas:'sl'},do:[{ustack:'dw',on:'target',add:1,cap:5,dur:6}]} ],   //   with Worrying the Cut: a Deep Wound a hit
    sl_3_4:[ {on:'skillTgt',skill:'hookline',if:{noHolder:'agT'},do:[{retarget:{team:'enemy',has:'sl',withinOpt:'range',withinAdd:P('reach.sl',0),order:'lowMax',n:1}}]},   // Watching Brief
             {on:'out',if:{casting:'hookline',targetHas:'sl'},more:R(0.03)} ],
    sl_4_1:[ {on:'lockpick',do:[{untarget:R(0.1)}]} ],                                                // Spring the Trap
    sl_5_2:[ {on:'dodged',do:[{window:'ctr',dur:99}]}, {on:'out',if:{window:'ctr',auto:true},more:0.30,do:[{window:'ctr',end:true}]} ],   // Counter-Cut
    sl_5_3:[ {on:'in',less:2,per:{field:'_talDodge',of:'self'}} ],                                    // Rolling with It
    sl_5_4:[ {stat:{move:R(0.05)},if:{targetHas:'sl'}} ],                                             // Keep Up
    sl_6_2:[ {stat:{crit:R(0.04)},if:{window:'ctr'}} ],                                               // Make Them Miss
    sl_6_3:[ {on:'in',less:R(0.01)} ],                                                                // Loose Shoulders
    sl_6_1:[ {on:'tick',if:{selfMin:{slow:1e-9}},do:[{weaken:'slowMul',by:R(0.08)}]} ],               // Slippery
    sl_4_3:[ {on:'hit',if:{crit:true},do:[{heal:{pct:R(0.005),of:'maxHp'},on:ME}]} ],                 // Gallows Humour
    sl_6_4:[ {param:'sl.n',add:R(1)} ],                                                               // Four Names
    sl_7_1:[ {on:'lockpick',do:[{mark:'sl',on:'source',dur:12,cap:{b:2,$:'sl.n'},added:'slAdd',longest:true},{slow:0.30,dur:2,on:'source'}]} ],   // Jailbreak
    sl_7_3:[ {stat:{dodge:R(0.01)},if:{selfHpBelow:0.40}} ],                                          // Last Reflex
    sl_7_4:[ {param:'reach.sl',add:R(1)},                                                             // No Distance Too Far
             {on:'skillTgt',skill:'hookline',unless:'sl_3_4',if:{tgtNone:true,noHolder:'agT'},do:[{retarget:{team:'enemy',has:'sl',withinOpt:'range',withinAdd:R(1),order:'lowMax',n:1}}]} ],
    sl_8_1:[ {on:'lockpick',do:[{heal:{pct:R(0.02),of:'maxHp'},on:ME}]} ],                           // Nobody's Hand
    sl_8_2:[ {on:'dodged',do:[{window:'rtc',dur:2}]}, {stat:{dodge:R(0.02)},if:{window:'rtc'}} ],     // Read Them Coming
    sl_8_3:[ {on:'hurt',if:{hitMin:{pct:0.10,of:'maxHp'}},do:[{window:'bj',dur:99}]}, {on:'out',if:{window:'bj',auto:true},more:R(0.08),do:[{window:'bj',end:true}]} ],   // Bad Joke
    sl_9_2:[ {on:'dodged',if:{selfHpBelow:0.30},do:[{cd:'green',add:-2}]} ],                          // Bolt Hole
    sl_9_3:[ {on:'out',if:{targetHas:'sl'},critMore:R(0.03)} ],                                       // Steel Nerve
    sl_9_4:[ {on:'hit',if:{targetHas:'sl'},do:[{heal:{pct:R(0.03),of:'hpLost'},on:ME}]} ],            // Long Way Round
    sl_10_1:[ {on:'lockpick',do:[{window:'esc',dur:3}]}, {stat:{dodge:R(0.03)},if:{window:'esc'}} ],  // Escape Artist
    sl_10_3:[ {on:'cd',skill:'blue',add:R(-0.3)} ],                                                   // Fast Hands
    sl_11_1:[ {param:'lp.fast',add:1} ],                                                              // Keys to the Gaol: the clock runs twice as fast
    sl_11_2:[ {on:'dodged',do:[{stack:'patter',add:1}]}, {on:'out',more:R(0.005),per:'patter'} ],     // Patter
    sl_11_4:[ {on:'death',if:{unitHas:'sl'},do:[{stack:'so',add:1}]}, {stat:{atk:R(0.01)},per:'so'} ],   // Struck Off
    sl_12_1:[ {on:'wave',do:[{stack:'lp',set:'max'},{window:'sr',dur:5}]}, {stat:{aspd:R(0.02)},if:{window:'sr'}} ],   // Staying for the Rain
    sl_12_2:[ {stat:{dodge:R(0.002)},per:'patter'} ],                                                 // Always Laughing
    sl_12_3:[ {on:'dodged',do:[{window:'ll',dur:99}]}, {on:'out',if:{window:'ll'},critMore:R(0.05),do:[{window:'ll',end:true}]} ],   // Last Laugh
    sl_12_4:[ {on:'kill',if:{targetHas:'sl'},do:[{heal:{pct:R(0.03),of:'maxHp'},on:ME}]} ],           // Crossed Off
    sl_13_2:[ {on:'in',icd:20,if:{dropBelow:0.30},do:[{miss:true},{untarget:1.5},{mark:'agT',on:'source',unique:true},{cd:'green',set:0},{stack:'ag3',set:3}]},   // Already Gone (SIGNATURE)
              {on:'skillTgt',skill:'hookline',if:{holderAlive:'agT'},do:[{retarget:'holder:agT'},{mark:'agT',on:'holder:agT',clear:true}]},   //   Hookline at the attacker
              {on:'crit',if:{stackMin:{ag3:1}},force:true,do:[{stack:'ag3',add:-1}]} ]                //   her next 3 hits crit
  },
  /* one sentence runs, another waits for a ruling */
  partial:{},
  /* nothing implemented: the text cannot run against her real kit. Each one is written up for the owner. */
  ruling:{
    sc_5_2:'"shields on a wounded enemy absorb 30% less": a shield in the game is one number that soaks a hit whole; "absorb less" has two readings (a smaller shield, or part of each hit passing through)',
    sl_n1:'"attacks that hit more than one target": the game does not know, when a hit lands on her, whether the same attack hits anyone else',
    sl_10_2:'"during its three cuts" / "the next cut": Razor Tempest\'s three cuts land in the same instant, so no attack can come between them'
  }
};

return module.exports;})();
  MECH["vireo"]=(function(){const module={exports:{}};
/* VIREO - what her learned talents do in a fight (the mechanics; her 8 plain stat talents are read from their tooltips by the generator).
   Hand-authored DATA for the primitives in talents-mech/_engine.js; tools/build_talent_fx.py copies this file into talents-fx.js.
   A correction to a number or a condition is an edit HERE, then:  python tools/build_talent_fx.py
   How rows are written: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
   Her real kit (the code, not the tooltip wording):
   - Crescendo ('crescendo', green, cd 7): heals EVERY ally, herself included, for 200% of her ability power x the ring (healFrom: her healing power
     applies), then pushes a heal over time of 40% AP x the ring each second for 5 s (o.dur; healing power does NOT apply to it). The ring count is the
     engine's `_crescStk`: +1 a cast, at most 4, +25% a ring. NOTHING ever resets it in a fight: from the 4th Crescendo on, every one rings at 4.
   - Harmony ('harmonyshield', blue, cd 9): every ally whose centre is within 10 m (o.radius) of the MOST WOUNDED ally (lowestAlly: lowest HP share)
     gets shield = max(its shield, 240% AP x o.mul) for 12 s (o.dur). No damage, no heal.
   - Grand Symphony ('symphony', ult): every ally on the field healed 30% AP (healFrom), every enemy hit for 30% AP magic (dealDamage).
   - Perfect Pitch (passive): each Crescendo / Symphony heal also writes shield = max(shield, heal x 50%+ (40%+ on Symphony)), shieldT 5 s (6 s).
   - Her basic attacks are magic (damageProfile Healer). One shield number per unit: every shield in the game is the same pool.
   "Her heals" below = the heals of her skills: Crescendo's heal and each tick of its mending, Grand Symphony's heal. Heals her talents make (Encore,
   Choir Dome, Held Note...) are not "her heals" for her other talents (no cascades, 03 section 6.2). "An ally" = another hero on her side.
   Talents whose text cannot run against that kit are NOT guessed at: they are written up for the owner in WIRING/06 - VIREO - talents that need a ruling.md. */
const R=(x,b)=>({r:x,b:b||0});            // x per rank (+ a base)
const P=(name,b)=>({$:name,b:b||0});      // a base + everything her learned talents add to the named number
const AL={team:'ally',others:true};       // her allies: the other heroes on her side (never a summon)
const SONG='#e0b6ff';
const CHORD_SEL={team:'enemy',of:'target',within:P('chord.r',2)};              // the shattering enemy and every enemy within 2 m of it (body to body)
const ENCORE=[{atOne:'unit'},{heal:{pct:{rk:'lh_4_4',r:0.08,$m:'enc.more'},of:'tgtMaxHp'},pow:true,on:'unit'},{emit:'encore',on:'unit'}];   // kept at 1 HP, healed 8% x Encore's rank
const PPW=(sk,d)=>({on:'pitch',if:{p:'pp.on',casting:sk},do:[{later:[{shield:{pct:P('pp.more',1),of:'hit'},mode:'max',dur:P('pp.dur',d),on:'target'}]}]});   // Perfect Pitch rewritten once the skill is done
const DB={r:0.05,$:'db.more'};                                                  // Keep Time's Downbeat bonus (Accent adds to it)
module.exports={
  hero:'vireo',
  casting:true,                         // rows ask which of her skills a heal or a hit comes from
  states:{
    ring:{max:P('ring.cap',4)},         // her Crescendo ring, as her talents count it (4; 6 with Swelling Chorus; 2 with Steady Choir)
    dis:{unit:true,max:5,dur:P('dis.dur',4),step:P('dis.step',0),gain:'disGain',full:'chord',chain:P('chain',0)},   // Dissonance, on each enemy
    bravo:{}, accel:{max:10}, bars:{max:6},
    str:{max:P('str.n',6),start:'max',refill:P('str.rt',10),refilled:'retune'}   // Strings: whole ones; a snapped one retunes on its own clock
  },
  /* needs: a talent that improves a mechanic does nothing without the talent that introduces it */
  needs:{ lh_2_1:'lh_1_1', lh_4_2:'lh_2_2', lh_9_2:'lh_7_2', lh_6_2:'lh_5_2', lh_6_3:'lh_5_3',
          lh_5_4:'lh_4_4', lh_8_4:'lh_4_4', lh_7_4:'lh_4_4', lh_10_4:'lh_4_4', lh_11_4:'lh_4_4', lh_12_4:'lh_4_4',
          ds_1_3:'ds_1_1', ds_1_4:'ds_1_1', ds_2_1:'ds_1_1', ds_3_1:'ds_1_1', ds_4_2:'ds_1_1', ds_5_1:'ds_1_1', ds_7_2:'ds_1_1', ds_8_3:'ds_1_1', ds_9_2:'ds_1_1', ds_11_1:'ds_1_1', ds_11_2:'ds_1_1',
          ds_4_1:'ds_3_1', ds_n1:'ds_3_1', ds_6_1:'ds_3_1', ds_8_1:'ds_3_1', ds_9_1:'ds_3_1', ds_12_1:'ds_3_1', ds_10_1:'ds_3_1',
          ds_5_2:'ds_4_2', ds_10_3:'ds_4_2', ds_6_2:'ds_5_2', ds_6_3:'ds_5_3',
          ds_4_4:'ds_3_4', ds_5_4:'ds_3_4', ds_7_4:'ds_3_4', ds_8_4:'ds_3_4', ds_10_4:'ds_3_4', ds_11_4:'ds_3_4', ds_12_4:'ds_3_4',
          li_2_1:'li_1_1', li_3_1:'li_1_1', li_4_1:'li_1_1', li_5_1:'li_1_1', li_5_3:'li_1_1', li_7_1:'li_1_1', li_7_2:'li_1_1', li_8_1:'li_1_1', li_9_1:'li_1_1', li_11_1:'li_1_1', li_12_1:'li_1_1',
          li_6_1:'li_5_1', li_6_3:'li_5_3', li_10_1:'li_3_1',
          li_4_2:'li_2_2', li_5_2:'li_2_2', li_6_2:'li_2_2', li_9_2:'li_2_2', li_11_2:'li_2_2', li_12_2:'li_2_2', li_13_2:'li_2_2',
          li_3_4:'li_1_4', li_4_4:'li_1_4', li_5_4:'li_1_4', li_6_4:'li_1_4', li_7_4:'li_1_4', li_8_4:'li_1_4', li_10_4:'li_1_4', li_11_4:'li_1_4', li_12_4:'li_1_4' },
  /* run for her whenever she has any mechanic talent: her ring count, her Crescendo mending made hers, Harmony's dome, Perfect Pitch's shield as an event */
  always:[
    {on:'kit',skill:'crescendo',do:[{stack:'ring',add:1},{tagHots:'kit'}]},
    {on:'cast',skill:'crescendo',do:[{tagHots:'crescendo'}]},
    {on:'kit',skill:'harmonyshield',if:{window:'harm'},do:[{emit:'domeEnd'}]},                       // a new Harmony replaces the one still up
    {on:'end:harm',do:[{emit:'domeEnd'}]},
    {on:'kit',skill:'harmonyshield',do:[{zone:'harm',at:'lowestAlly',radiusPx:{opt:'radius',d:0},dur:{opt:'dur',d:12},centre:true,only:true},{window:'harm',dur:{opt:'dur',d:12}}]},   // the dome: 10 m around the most wounded ally, where it was cast
    {on:'healed',if:{casting:['crescendo','symphony'],selfPass:'perfectpitch'},do:[{emit:'pitch',amt:{pct:1,of:'pitch'}}]},
    PPW('crescendo',5), PPW('symphony',6)
  ],
  talents:{
    /* ============================== THE LISTENING HALL ============================== */
    lh_1_1:[ {on:'healed',if:{who:'ally'},do:[{mark:'listen',on:'target',dur:P('listen.dur',4),longest:true},{emit:'listened'}]},   // Rapt Attention: every ally she heals is Listening
             {on:'teamIn',if:{targetHas:'listen',srcTeam:'enemy'},less:R(0.01)} ],                  //   and takes less damage
    lh_2_3:[ {param:'pp.on',add:1}, {param:'pp.more',add:R(0.04)} ],                                // Warm Tone: Perfect Pitch shields larger
    lh_n1:[  {on:'cd',skill:'green',add:R(-0.2)} ],                                                 // Breath Control
    lh_2_1:[ {param:'listen.dur',add:R(0.5)} ],                                                     // Hushed Hall
    lh_2_2:[ {on:'hotEnd',if:{tag:'crescendo',who:'ally'},do:[{hot:{pct:{r:0.10,$m:'song.more'},of:'hit'},perTick:true,dur:P('held.dur',5),every:1,on:'target',htag:'held'},{window:'held',dur:P('held.dur',5)}]},   // Held Note
             {on:'hurt',if:{window:'held'},do:[{unhot:'held'},{window:'held',end:true}]} ],         //   for as long as she is not hit
    lh_3_1:[ {on:'teamIn',if:{targetHas:'listen',srcTeam:'enemy',targetIs:Object.assign({has:'listen',order:'lowHp',n:1},AL)},less:0.08} ],   // Front Row
    lh_4_2:[ {param:'held.dur',add:R(1)} ],                                                         // Sustain
    lh_3_3:[ {on:'kit',skill:'harmonyshield',opt:{mul:{more:R(0.03)}}} ],                           // Wide Dome
    lh_n2:[  {on:'teamIn',if:{srcHas:'listen',auto:true,targetTeam:'enemy'},more:0.02},             // Sing Along (LINK)
             {on:'teamIn',req:'ds_1_1',if:{srcHas:'listen',auto:true,targetTeam:'enemy'},do:[{ustack:'dis',on:'target',add:1,lock:'singL',lockDur:1}]} ],   //   with Off Key: 1 Dissonance (each enemy once a second)
    lh_4_1:[ {on:'teamIn',if:{srcHas:'listen',targetTeam:'enemy'},more:R(0.01)} ],                  // Rapt Crowd
    lh_8_3:[ {param:'pp.on',add:1}, {param:'pp.dur',add:R(0.4)} ],                                  // Bright Timbre
    lh_4_4:[ {on:'teamLethal',by:'unit',once:'fight',if:{who:'ally',unitHas:'listen'},do:ENCORE} ], // Encore
    lh_5_1:[ {on:'teamIn',if:{srcHas:'spb',srcTeam:'enemy'},less:R(0.01)}, {on:'in',if:{srcHas:'spb'},less:R(0.01)},   // Spellbound: enemies that hit a Listening ally deal less
             {on:'teamIn',if:{targetHas:'listen',srcTeam:'enemy'},do:[{mark:'spb',on:'source',dur:2}]} ],
    lh_5_4:[ {on:'encore',do:[{mark:'curt',on:'target',dur:3}]}, {on:'teamIn',if:{targetHas:'curt',srcTeam:'enemy'},less:R(0.04)} ],   // Curtain Call
    lh_6_1:[ {on:'healOut',if:{who:'ally',targetHpBelow:0.40},more:R(0.02)} ],                      // Second Verse
    lh_9_3:[ {on:'healOut',skill:'crescendo',if:{targetIn:'harm'},more:R(0.03)} ],                  // Harmonic Swell (its heal and its mending)
    lh_8_4:[ {on:'encore',do:[{shield:{pct:R(0.05),of:'tgtMaxHp'},dur:5,pow:true,on:'target'}]} ],  // Bis (reading: lasts 5 s, as her Perfect Pitch shields)
    lh_7_2:[ {on:'cast',skill:'harmonyshield',do:[{mark:'listen',on:Object.assign({inZone:'harm'},AL),dur:{opt:'dur',d:12},longest:true},{emit:'listened'}]},   // Choir Dome: Listening for the dome's 12 s
             {on:'tick',period:1,if:{zone:'harm'},do:[{heal:{pct:{b:0.01,$:'dome.mend',$m:'song.more'},of:'tgtMaxHp'},pow:true,on:Object.assign({inZone:'harm'},AL)}]} ],   //   and it mends 1% of their max HP each second
    lh_7_4:[ {on:'encore',do:[{stack:'bravo',add:1}]}, {stat:{heal:R(0.02)},per:'bravo'} ],         // Bravo
    lh_8_1:[ {on:'healOut',if:{targetHas:'listen'},more:R(0.02)} ],                                 // Listen Closely
    lh_9_2:[ {param:'dome.mend',add:R(0.002)} ],                                                    // Resounding Dome
    lh_5_2:[ {param:'ring.cap',add:2}, {param:'pp.on',add:1},                                       // Swelling Chorus: up to 6 rings, +25% a ring as the engine's own
             {on:'healOut',skill:'crescendo',more:1/7,per:{stack:'ring',over:4}}, {on:'pitch',if:{casting:'crescendo'},more:1/7,per:{stack:'ring',over:4}} ],
    lh_5_3:[ {param:'ring.cap',add:-2}, {param:'ring.ecap',add:-2},                                 // Steady Choir: never louder than the 2nd ring...
             {on:'kit',skill:'crescendo',opt:{dur:{add:3}},do:[{field:'_crescStk',on:'self',max:P('ring.ecap',3)}]} ],   //   ...and its mending lasts 3 s longer
    lh_9_1:[ {on:'teamIn',by:'target',icd:6,if:{targetHas:'listen',srcTeam:'enemy',hitMin:{pct:0.15,of:'tgtMaxHp'}},do:[{mark:'rsil',on:'target'}]},   // Rapt Silence
             {on:'healOut',if:{targetHas:'rsil',casting:['crescendo','symphony']},mul:2,do:[{mark:'rsil',on:'target',clear:true}]} ],
    lh_6_2:[ {on:'healOut',skill:'crescendo',if:{stackMin:{ring:5}},more:R(0.05)} ],                // Long Swell: the 5th and 6th rings
    lh_6_3:[ {on:'healOut',skill:'crescendo',if:{hot:true,targetHpBelow:0.50},more:R(0.04)} ],      // Even Breath: Steady Choir's mending
    lh_10_1:[ {stat:{heal:R(0.03)},if:{atLeast:{n:4,of:Object.assign({has:'listen'},AL)}}} ],      // Full House
    lh_10_3:[ {on:'cast',skill:'crescendo',do:[{cleanse:1,on:Object.assign({ctrl:true,order:'lowHp',n:R(1)},AL)}]} ],   // Clean Tone
    lh_10_4:[ {on:'encore',do:[{heal:{pct:R(0.02),of:'tgtMaxHp'},pow:true,on:Object.assign({skip:'target'},AL)}]} ],   // Last Bow
    lh_11_1:[ {on:'in',if:{atLeast:{n:3,of:Object.assign({has:'listen'},AL)}},less:R(0.015)} ],    // Stage Presence
    lh_11_2:[ {on:'cast',skill:'harmonyshield',do:[{mark:'hsh',on:Object.assign({inZone:'harm'},AL)}]},   // Dome Song: the allies inside it
             {on:'domeEnd',do:[{heal:{pct:0.5,of:'tgtShield'},pow:true,on:Object.assign({has:'hsh'},AL)},{mark:'hsh',on:{team:'ally'},clear:true}]} ],
    lh_11_4:[ {on:'encore',do:[{mark:'saved',on:'target'}]}, {on:'healOut',if:{targetHas:'saved'},more:R(0.03)} ],   // Unbroken Tone
    lh_12_1:[ {on:'healed',by:'target',icd:3,if:{who:'ally',targetHas:'listen'},do:[{energy:R(1),on:'target'}]} ],   // Rising Applause
    lh_12_2:[ {param:'song.more',add:R(0.03)} ],                                                    // The Long Note: Held Note and Choir Dome
    lh_12_3:[ {on:'healed',if:{who:'ally',overMin:0,selfPass:'perfectpitch'},do:[{later:[{shield:{pct:R(0.10),of:'over'},dur:P('pp.dur',5),on:'target'}]}]} ],   // Mastery of Song
    lh_12_4:[ {param:'enc.more',add:R(0.05)} ],                                                     // Encore Bell
    lh_13_2:[ {on:'listened',if:{some:AL,none:Object.assign({lacks:'listen'},AL)},do:[{window:'ovat',dur:6,cd:30}]},   // Standing Ovation (SIGNATURE): every ally Listening
              {on:'healOut',if:{window:'ovat'},more:0.40},                                          //   heals 40% stronger
              {on:'healed',if:{window:'ovat'},do:[{later:[{shield:{pct:1,of:'heal'},dur:5,on:'target'}]}]},   //   every heal also shields for its full amount
              {on:'teamLethal',if:{window:'ovat',who:'ally'},do:ENCORE} ],                          //   any ally who would die is caught by Encore

    /* ============================== DISSONANCE ============================== */
    ds_1_1:[ {on:'healed',if:{who:'ally'},do:[{ustack:'dis',on:{team:'enemy',of:'target',n:1},add:1,lock:'disL',lockDur:1,emit:'disHeal'}]},   // Off Key: the enemy nearest the ally she heals
             {on:'hit',unless:'ds_13_2',if:{casting:'symphony'},do:[{ustack:'dis',on:'target',add:P('sym.dis',1)}]},   //   Grand Symphony: every enemy it hits
             {on:'teamIn',if:{targetTeam:'enemy',kind:'magic',targetUst:{dis:1}},more:R(0.01),per:{ust:'dis',of:'target'}} ],   //   each stack: more magic damage taken (from anyone)
    ds_1_3:[ {on:'out',if:{kind:'magic',targetUst:{dis:1}},more:R(0.02)} ],                         // Sharp Voice
    ds_1_4:[ {on:'hit',if:{auto:true},icd:[4,3,2],do:[{ustack:'dis',on:'target',add:1}]} ],         // Quick Bow
    ds_2_1:[ {param:'dis.dur',add:R(1)} ],                                                          // Grating
    ds_2_2:[ {on:'out',if:{casting:'symphony'},more:R(0.04)} ],                                     // Loud Finale
    ds_3_1:[ {on:'chord',do:[{ustack:'dis',on:'target',set:0},{dmg:{pct:R(0.20),of:'apow'},on:CHORD_SEL,tag:'chord',color:SONG},{emit:'chordDone'}]} ],   // Broken Chord
    ds_4_2:[ {on:'cast',skill:'crescendo',unless:'ds_5_2',do:[{dmg:{pct:R(0.10),of:'lastHeal'},on:{team:'enemy',ust:{dis:1},order:'most:dis',n:1},tag:'refrain',color:SONG}]} ],   // Biting Refrain
    ds_n1:[  {on:'chordDone',do:[{heal:{pct:R(0.06),of:'apow'},pow:true,on:Object.assign({order:'lowHp',n:1},AL)}]} ],   // Resolution
    ds_3_4:[ {on:'tick',period:6,do:[{mark:'sour',on:{team:'enemy',order:'high:dmg',n:1},dur:P('sour.dur',3),unique:true},{emit:'sour',on:'holder:sour'}]},   // Sour Note
             {on:'teamIn',if:{srcHas:'sour'},less:R(0.03)}, {on:'in',if:{srcHas:'sour'},less:R(0.03)} ],
    ds_4_1:[ {param:'chord.r',add:R(0.3)} ],                                                        // Shrapnel Chord
    ds_5_2:[ {on:'cast',skill:'crescendo',do:[{dmg:{pct:{rk:'ds_4_2',r:0.10},of:'lastHeal'},on:{team:'enemy',ust:{dis:3}},tag:'wound',color:SONG}]} ],   // Wound Song
    ds_5_3:[ {on:'tick',period:1,req:'ds_1_1',if:{zone:'harm'},do:[{ustack:'dis',on:{team:'enemy',inZone:'harm'},add:1}]},   // Silent Dome: 1 Dissonance a second inside
             {on:'tick',period:0.5,if:{zone:'harm'},do:[{slow:P('sdome.slow',0.20),dur:0.6,on:{team:'enemy',inZone:'harm'}}]} ],   //   and 20% slower
    ds_4_4:[ {param:'sour.dur',add:R(0.5)} ],                                                       // Flat Ear
    ds_5_1:[ {stat:{aspd:R(-0.01)},to:{team:'enemy',ust:{dis:3}}} ],                                // Ringing Ears
    ds_6_3:[ {param:'sdome.slow',add:R(0.05)} ],                                                    // Hum of the Dome
    ds_5_4:[ {on:'teamIn',if:{targetHas:'sour',srcTeam:'ally'},more:R(0.02)} ],                     // Tin Ear (her whole team, her own hits too)
    ds_6_1:[ {on:'chordDone',do:[{energy:R(1)}]} ],                                                 // Feedback
    ds_6_2:[ {on:'dmg:wound',more:R(0.05)} ],                                                       // Cutting Voice
    ds_2_3:[ {on:'out',if:{casting:'symphony'},ignoreMr:R(0.03)} ],                                 // Clarity. PARTIAL: the Broken Chord half waits
    ds_6_4:[ {on:'healOut',less:R(0.04)}, {on:'out',more:R(0.04)} ],                                // Harsh Voice (RISK)
    ds_7_2:[ {on:'pitch',if:{who:'ally'},do:[{ustack:'dis',on:{team:'enemy',of:'target',n:1},add:1}]} ],   // Shrill Pitch
    ds_7_4:[ {on:'disGain',if:{targetHas:'sour'},do:[{dmg:{pct:R(0.03),of:'apow',k:1},on:'target',tag:'sting',color:SONG}]} ],   // Off-Beat Sting: per stack that lands
    ds_8_1:[ {param:'chain',add:R(1)} ],                                                            // Chain Reaction
    ds_8_3:[ {on:'disHeal',chance:R(0.10),do:[{ustack:'dis',on:{team:'enemy',of:'unit',n:1,skipN:1},add:1}]} ],   // Projection: the next-nearest enemy to that ally
    ds_8_4:[ {on:'sour',do:[{silence:R(0.3),on:'target'}]} ],                                       // Long Silence
    ds_9_1:[ {on:'chordDone',do:[{ustack:'dis',on:CHORD_SEL,add:2}]} ],                             // Splitting Chord
    ds_9_2:[ {stat:{apow:R(0.002)},per:{ust:'dis',of:'field',max:25}} ],                            // Cacophony
    ds_9_3:[ {on:'out',if:{casting:'symphony',targetHpBelow:0.50},more:R(0.03)} ],                  // Cold Stage
    ds_12_3:[ {stat:{hp:R(-0.01),apow:R(0.02)}} ],                                                  // Thin Voice (RISK)
    ds_10_3:[ {on:'dmg:refrain',more:R(0.03)}, {on:'dmg:wound',more:R(0.03)} ],                     // Harsh Timbre
    ds_10_4:[ {on:'teamHeal',if:{unitHas:'sour'},less:R(0.05)} ],                                   // Tone Deaf
    ds_11_1:[ {param:'dis.step',add:R(0.6)} ],                                                      // Afterring
    ds_11_2:[ {param:'sym.dis',add:1} ],                                                            // Fortissimo: 2 a hit (each one at 5 sets off Broken Chord, as every Dissonance does)
    ds_11_4:[ {on:'in',if:{srcHas:'sour'},less:R(0.015)} ],                                         // Discord Ward
    ds_12_1:[ {on:'dmg:chord',more:R(0.05)} ],                                                      // Composer's Spite
    ds_12_2:[ {on:'out',if:{casting:'symphony'},more:R(0.03),per:'ring'} ],                         // Ruinous Swell
    ds_10_1:[ {on:'dmg:chord',if:{targetMin:{shield:1e-6}},more:R(0.05)}, {on:'chordDone',do:[{strip:R(0.10),on:CHORD_SEL}]} ],   // Crack the Glass
    ds_12_4:[ {on:'death',if:{unitHas:'sour'},do:[{mark:'sour',on:{team:'enemy',order:'high:dmg',n:1},dur:{r:1,b:3,$:'sour.dur'},unique:true},{emit:'sour',on:'holder:sour'}]} ],   // Sour Finale
    ds_13_2:[ {on:'cast',skill:'symphony',do:[{mark:'wmB',on:{team:'enemy'},clear:true},{ustack:'dis',on:{team:'enemy'},set:'max',burst:true},{window:'wm',dur:5}]},   // The Whole Music (SIGNATURE)
              {on:'tick',if:{window:'wm'},do:[{kill:true,on:{team:'enemy',hpBelow:0.12,boss:false},tag:'wm',color:SONG},   //   below 12% while it plays: falls silent and dies
                {dmg:{pct:0.06,of:'tgtMaxHp'},on:{team:'enemy',hpBelow:0.12,boss:true,lacks:'wmB'},tag:'wm',color:SONG},{mark:'wmB',on:{team:'enemy',hpBelow:0.12,boss:true}}]} ],   //   a boss: 6% of its max HP, once per Symphony

    /* ============================== THE LIVING INSTRUMENT ============================== */
    li_1_1:[ {on:'tick',period:2,rate:P('beat.rate',1),rateUp:[{add:P('beat.low',0),if:{selfHpBelow:0.40}},{add:P('beat.acc',0),per:'accel'}],do:[{emit:'beat'}]},   // Keep Time: a Beat every 2 s
             {on:'beat',if:{noWindow:'final'},every:P('db.n',4),do:[{emit:'downbeat'}]}, {on:'beat',if:{window:'final'},do:[{emit:'downbeat'}]},   //   every 4th a Downbeat
             {on:'downbeat',do:[{window:'db',dur:99}]},                                              //   it waits for her next heal or attack
             {on:'out',if:{window:'db',auto:true},more:DB,do:[{window:'db',end:true}]},
             {on:'kit',if:{window:'db',casting:['crescendo','symphony']},do:[{window:'dbc',dur:99},{window:'db',end:true}]},
             {on:'healOut',if:{window:'dbc'},more:DB}, {on:'out',if:{window:'dbc'},more:DB}, {on:'cast',do:[{window:'dbc',end:true}]} ],
    li_1_3:[ {on:'cd',mul:[1/1.01,1/1.02,1/1.03,1/1.04,1/1.05]} ],                                  // Practised Hands: her skills come back 1% faster
    li_1_4:[ {on:'in',if:{hitMin:{pct:0.10,of:'maxHp'},stackMin:{str:1}},less:R(0.06),do:[{stack:'str',spend:1,then:[{emit:'snap'}]}]} ],   // Rib Strings
    li_2_1:[ {on:'downbeat',do:[{energy:R(1)}]} ],                                                  // Metronome
    li_2_2:[ {on:'tick',period:P('bar.t',8),do:[{stack:'bars',add:1}]}, {stat:{apow:R(0.005)},per:'bars'} ],   // The Unfinished Score
    li_3_1:[ {on:'downbeat',do:[{energy:{b:3,$:'cue.more'},on:Object.assign({below:{energy:100},order:'high:energy',n:1},AL)}]} ],   // Cue
    li_3_3:[ {on:'ccIn',less:R(0.04)} ],                                                            // Poise
    li_3_4:[ {param:'str.rt',add:R(-0.6)} ],                                                        // Retune
    li_4_1:[ {param:'db.more',add:R(0.01)} ],                                                       // Accent
    li_4_2:[ {on:'wave',once:'fight',do:[{stack:'bars',atLeast:R(1)}]} ],                           // Rehearsed
    li_4_4:[ {on:'snap',do:[{dmg:{pct:R(0.15),of:'apow'},on:'source',tag:'twang',color:SONG}]} ],   // Twang: the attacker
    li_5_1:[ {param:'db.n',add:-1} ],                                                               // Waltz Time
    li_5_2:[ {stat:{heal:R(0.003)},per:'bars'} ],                                                   // Memorised
    li_5_3:[ {on:'downbeat',do:[{dmg:{pct:0.30,of:'apow'},on:{team:'enemy',n:P('march.n',1)},tag:'march',color:SONG}]} ],   // March Time
    li_5_4:[ {on:'in',less:R(0.003),per:'str'} ],                                                   // Strung Tight
    li_6_1:[ {on:'downbeat',do:[{cd:'blue',add:R(-0.2)}]} ],                                        // Three-Step
    li_6_2:[ {param:'bar.t',add:R(-0.5)} ],                                                         // Sight Reading
    li_6_3:[ {param:'march.n',add:R(1)} ],                                                          // Drumline
    li_6_4:[ {stat:{apow:R(0.02)},per:{stack:'str',missing:true}} ],                                // Frayed Edge (RISK)
    li_7_1:[ {param:'beat.rate',add:R(0.01)} ],                                                     // Quick Tempo
    li_7_2:[ {on:'kit',skill:'crescendo',if:{window:'dbc'},do:[{stack:'ring',add:1},{field:'_crescStk',on:'self',add:1,max:P('ring.ecap',3)},{window:'sm2',dur:99}]},   // Second Movement: 2 rings
             {on:'cd',skill:'green',if:{window:'sm2'},add:-1,do:[{window:'sm2',end:true}]} ],       //   and back 1 s sooner
    li_7_4:[ {stat:{armor:R(0.002),mr:R(0.002)},per:'str'} ],                                       // Taut Frame
    li_8_1:[ {param:'beat.low',add:R(0.06)} ],                                                      // Rallentando
    li_8_4:[ {param:'str.n',add:R(1)} ],                                                            // Spare Strings
    li_9_1:[ {param:'beat.acc',add:0.03}, {on:'downbeat',do:[{stack:'accel',add:1}]} ],             // Accelerando
    li_9_2:[ {on:'kit',skill:'harmonyshield',opt:{mul:{more:R(0.01),per:'bars'}}} ],                // Long Rehearsal
    li_9_3:[ {on:'kit',once:'wave',do:[{window:'ov',dur:99}]},                                      // Overture: her first skill each wave
             {on:'kit',skill:'harmonyshield',if:{window:'ov'},opt:{mul:{more:R(0.04)}}},
             {on:'healOut',if:{window:'ov'},more:R(0.04)}, {on:'out',if:{window:'ov'},more:R(0.04)}, {on:'cast',do:[{window:'ov',end:true}]} ],
    li_10_1:[ {param:'cue.more',add:R(1)} ],                                                        // Conductor's Eye
    li_10_4:[ {on:'snap',if:{stackEmpty:'str'},do:[{heal:{pct:R(0.06),of:'maxHp'},pow:true,on:'self'},{stack:'str',refillIn:3}]} ],   // Snap Back
    li_11_1:[ {on:'downbeat',do:[{window:'pocket',dur:1}]}, {on:'in',if:{window:'pocket'},less:R(0.03)} ],   // In the Pocket
    li_11_2:[ {stat:{nrg:0.25},if:{stackMin:{bars:6}}} ],                                           // Memory of the Whole
    li_11_4:[ {on:'retune',do:[{heal:{pct:R(0.01),of:'maxHp'},pow:true,on:'self'}]} ],              // Fine Tuning
    li_12_1:[ {on:'downbeat',icd:8,do:[{energy:R(1),on:AL}]} ],                                     // Tempo Giusto
    li_12_2:[ {on:'out',if:{window:'db',auto:true,stackMin:{bars:6}},more:R(0.03)},                 // Last Rehearsal: the Downbeat bonus at 6 Bars
              {on:'healOut',if:{window:'dbc',stackMin:{bars:6}},more:R(0.03)}, {on:'out',if:{window:'dbc',stackMin:{bars:6}},more:R(0.03)} ],
    li_10_3:[ {on:'out',if:{casting:'symphony'},more:R(0.02)}, {on:'healOut',if:{casting:'symphony'},more:R(0.02)} ],   // Bowing Arm
    li_12_4:[ {on:'teamIn',icd:4,if:{targetTeam:'ally',hero:true,srcTeam:'enemy',targetHpBelow:0.25,stackMin:{str:1}},mul:0.5,   // Heartstrings
               do:[{stack:'str',spend:1,then:[{emit:'snap'}]},{heal:{pct:R(0.02),of:'tgtMaxHp'},pow:true,on:'target'}]} ],
    li_13_2:[ {on:'kit',skill:'symphony',if:{stackMin:{bars:6}},do:[{window:'fnote',dur:99}]},      // The Final Note (SIGNATURE). PARTIAL: the Strings' strike waits
              {on:'healOut',if:{window:'fnote',casting:'symphony'},more:1.5}, {on:'out',if:{window:'fnote',casting:'symphony'},more:1.5},
              {on:'cast',skill:'symphony',if:{window:'fnote'},do:[{window:'fnote',end:true},{window:'final',dur:6},{stack:'str',set:0},{stack:'bars',add:-3}]} ]
  },
  /* one sentence runs, another waits for a ruling */
  partial:{
    ds_2_3:'"Broken Chord ignores magic resist": talent damage already lands as stated (not reduced by magic resist), so there is nothing to ignore',
    li_13_2:'"all her Strings snap at once to strike every enemy": the strike has no size'
  },
  /* nothing implemented: the text cannot run against her real kit. Each one is written up for the owner. */
  ruling:{}
};

return module.exports;})();
  /* ====================================================================================================================
     MECHANICS RUNTIME  (source: talents-mech/_engine.js - tools/build_talent_fx.py copies it into talents-fx.js)
     What a learned talent DOES in a fight, beyond plain stats. The page's fight code calls a small fixed set of hooks, each
     behind a guard that is false for a unit with no learned mechanic talent (`u._tal` is only ever set by attach()).
     A talent is ROWS OF DATA (talents-mech/<hero>.js); this file is the dozen generic primitives that read those rows.
     Rules (design doc: WIRING/03 - MECHANICS LAYER): no Math.random / clocks - chance is E.rnd() (the fight's seeded stream) and
     is drawn only inside a learned row; per-fight state lives in u._tal.s (and, for marks / DoTs, on the other unit keyed by the
     owner's uid); nothing here is ever written to a snap; rows run in sorted talent-id order.
     ==================================================================================================================== */
  let E=null;                                   // the fight's own functions, handed over once by the page: TalentFx.bind({...})
  const OVER={};                                // TalentFx.define(hero, def): a definition supplied at run time (the tests' scripted talents)
  const defOf=hero=>Object.prototype.hasOwnProperty.call(OVER,hero)?OVER[hero]:MECH[hero];
  function bind(api){ E=api; }
  function bindMore(api){ if(E) Object.assign(E,api); }   // more of the fight's functions, on a separate page line after bind (Aldren: summon, unsummon, castSlot)
  function define(hero,def){ if(def==null) delete OVER[hero]; else OVER[hero]=def; }

  /* ---- a value at a rank. number | [by rank] | {r: per rank, b: base, rk: 'other talent id' (use ITS rank), $: 'named number'
          (everything learned talents add to it), $m: 'named number' used as a multiplier (1 + it)} | any object / list (resolved deep) */
  const isVal=v=>('r' in v)||('$' in v)||('$m' in v);
  function rv(v,rank,P,R){
    if(v==null||typeof v!=='object') return v;
    if(Array.isArray(v)){ if(v.length&&v.every(x=>typeof x==='number')) return v[Math.max(1,Math.min(rank,v.length))-1]; return v.map(x=>rv(x,rank,P,R)); }
    if(isVal(v)){ let x=(v.b||0)+(v.r||0)*(v.rk?(R[v.rk]||0):rank); if(v.$) x+=(P[v.$]||0); if(v.$m) x*=1+(P[v.$m]||0); return x; }
    const o={}; for(const k in v) o[k]=rv(v[k],rank,P,R); return o; }

  /* ---- attach: build u._tal from the learned list [[id, rank], ...]. Returns null (and sets nothing) when the hero has no mechanics
          definition or none of the learned talents has a mechanic row - such a unit then runs none of the hooks. */
  function attach(u,hero,list){
    const M=defOf(hero); if(!u||!M||!M.talents||!list||!list.length) return null;
    const r={}, ids=[]; for(const e of list){ const n=e&&(e[1]|0); if(n>0&&typeof e[0]==='string'&&!(e[0] in r)){ r[e[0]]=n; ids.push(e[0]); } }
    ids.sort();
    const tr=TREES[hero], pts={}; if(tr) for(const id of ids){ const t=tr.of[id]; if(t!=null) pts[tr.ids[t]]=(pts[tr.ids[t]]||0)+r[id]; }
    const live=row=>!((row.req&&!r[row.req])||(row.unless&&r[row.unless])||(row.pts&&!((pts[row.pts[0]]||0)>=row.pts[1])));
    const NEED=M.needs||{}, has=id=>!NEED[id]||!!r[NEED[id]];              // needs: {talent: the talent that introduces what it improves} - without that one it does nothing
    const P={}; let any=false;
    for(const id of ids){ const rows=M.talents[id]; if(!rows) continue; any=true; if(!has(id)) continue;
      for(const row of rows) if(row.param&&live(row)) P[row.param]=(P[row.param]||0)+rv(row.add,r[id],{},r); }
    if(!any) return null;
    const T={hero,r,pts,P,on:{},stats:[],auras:[],st:{},fn:M.fn||{},watch:false,
      s:{k:{},w:{},lim:{},m:{},ml:{},roll:{},ap:{},z:{},zn:{},tm:[],au:[],later:[],pt:{},dq:[],sm:[],cur:null,wave:0,undy:0,d:0,fresh:true,moved:false}};
    for(const k in (M.states||{})) T.st[k]=rv(M.states[k],0,P,r);
    const add=(id,row,i,rank)=>{ if(row.param||!live(row)) return; const c=rv(row,rank,P,r); c.key=id+'#'+i; c.id=id;
      if(c.stat){ (c.to?T.auras:T.stats).push(c); if(c.stat.nrg) T.nrg=true; return; }
      for(const ev of (Array.isArray(c.on)?c.on:[c.on])) (T.on[ev]=T.on[ev]||[]).push(c); };
    (M.always||[]).forEach((row,i)=>add('',row,i,1));
    for(const id of ids){ const rows=M.talents[id]; if(rows&&has(id)) rows.forEach((row,i)=>add(id,row,i,r[id])); }
    if(M.casting){ T.on.kit=T.on.kit||[]; T.on.cast=T.on.cast||[]; }        // the hero's rows ask "which skill is this hit from": keep the two skill hooks on
    if(M.points) T.on.at=T.on.at||[];                                         // the hero's rows read where her area skills land ('pt:<skill>'): the at hook must run for each of them
    if(M.summons) T.on.summon=T.on.summon||[];                                // his summons carry his rows (u._talS): the summon hook must run for each one he calls
    if(M.pages){ T.on.pagePre=T.on.pagePre||[]; T.on.page=T.on.page||[]; }   // rows ask "is this hit a Living Page" ('casting:page'): the two page hooks must run for each page spent
    if(T.on.healed||T.on.hotEnd) T.on.healOut=T.on.healOut||[];              // rows about her heals landing: the healOut hook must run for every heal of hers
    if(T.on.skillAt) T.on.skillTgt=T.on.skillTgt||[];                         // rows about a skill's chosen target: the skillTgt hook must run
    for(const k in T.st){ const d=T.st[k]; if(d.start==='max') T.s.k[k]={n:stMax(T,u,k),t:0,idle:0}; }   // a pool that starts full (Vireo's Strings)
    T.watch=!!(T.on.death||T.on.teamIn||T.on.teamHeal||T.on.teamLethal||T.on.teamCc||T.on.teamNrg||M.watch===true||(Array.isArray(M.watch)&&M.watch.some(id=>r[id])));   // watch: true, or the talents whose rows read what other units remember ('lastHit')
    u._tal=T; return T; }

  /* ---- named stacks / pools (T.st[name] = {max, dur, fade:{after,every,lose,unless}, wave:'reset'}) ---- */
  const stGet=(T,name)=>{ const k=T.s.k[name]; return k?k.n:0; };
  function stMax(T,u,name){ const d=T.st[name]; return (!d||d.max==null)?Infinity:amtOf(T,u,d.max,null); }
  function stSet(T,u,name,n){ const d=T.st[name]||{}, k=T.s.k[name]||(T.s.k[name]={n:0,t:0,idle:0}); const was=k.n;
    k.n=Math.max(0,Math.min(stMax(T,u,name),n)); if(k.n>was){ k.idle=0; if(d.dur) k.t=d.dur; }
    if(d.refill&&k.n<was){ const rf=k.rf||(k.rf=[]), at=E.now()+amtOf(T,u,d.refill,null); for(let i=Math.round(was-k.n);i>0;i--) rf.push(at); }   // refill: each unit spent comes back on its own after that many seconds
    return k.n-was; }
  /* stacks a hero keeps ON OTHER UNITS (states.<name> = {unit:true, max, dur, step, gain:'event', full:'event', chain}: Vireo's Dissonance). Stored with her marks
     (t._talM[uid]['#'+name] = {v, until}); all of it lapses `dur` after the last gain, or with `step` one stack at a time, `step` seconds apart. Read lazily (no tick). */
  function ustGet(T,u,t,name){ const o=t&&t._talM&&t._talM[u.uid], m=o&&o['#'+name]; if(!m) return 0; const now=E.now();
    if(now>=m.until){ const st=(T.st[name]&&T.st[name].step)||0; if(!(st>0)){ delete o['#'+name]; return 0; }
      const k=Math.floor((now-m.until)/st+1e-9)+1; m.v-=k; m.until+=k*st; if(m.v<=0){ delete o['#'+name]; return 0; } }
    return m.v; }
  function ustPut(T,u,t,name,n,dur){ const M=t._talM||(t._talM={}), o=M[u.uid]||(M[u.uid]={}); if(!(n>0)){ delete o['#'+name]; return; }
    const d=T.st[name]||{}, p=o['#'+name]; let until=E.now()+(dur!=null?dur:amtOf(T,u,d.dur||Infinity,null));
    if(d.longest&&p&&p.until>until) until=p.until;                                // longest: a gain never shortens a longer lapse (Vex's Deep Wounds: the 6 s ones and the wound's own)
    o['#'+name]={v:n,until}; }
  /* a unit stack reached its max: the state's `full` event. Inside such an event a further unit reaching max is set off only while the cascade allowance
     (`chain`) lasts, and after the current one (no re-entry): one at a time, in order. */
  function ustFull(T,u,t,d,ctx){ const s=T.s; if(!d.full||!T.on[d.full]) return;
    if(s.fq){ if(s.fb>0&&s.fq.indexOf(t)<0){ s.fb--; s.fq.push(t); } return; }
    s.fq=[t]; s.fb=amtOf(T,u,d.chain||0,null);
    try{ while(s.fq.length){ const x=s.fq.shift(); if(x.alive) run(T,u,d.full,Object.assign({},ctx,{tgt:x,unit:x})); } } finally{ s.fq=null; } }
  const ustField=(T,u,name)=>{ let n=0; const U=E.units(); for(let i=0;i<U.length;i++){ const x=U[i]; if(x.alive&&x.team!==u.team) n+=ustGet(T,u,x,name); } return n; };
  const isBoss=x=>!!((x.t&&x.t.isboss)||x._raidBoss);
  const winOn=(T,name)=>{ const w=T.s.w[name]; return !!w&&w.t>0; };

  /* ---- marks: on the OTHER unit, keyed by the owner's uid: t._talM[uid][name] = {t0, until, v} ---- */
  function markOf(u,t,name){ if(!t||!t._talM) return null; const o=t._talM[u.uid], m=o&&o[name]; if(!m) return null;
    if(m.until!=null&&E.now()>=m.until){ delete o[name]; return null; } return m; }
  function setMark(T,u,t,name,a){ if(!t) return; const now=E.now(); a=a||{};
    if(a.unique){ const old=T.s.m[name]; if(old&&old!==t&&old.alive&&old._talM&&old._talM[u.uid]) delete old._talM[u.uid][name]; T.s.m[name]=t; }
    if(a.cap!=null){ const L=T.s.ml[name]||(T.s.ml[name]=[]), n=Math.max(1,Math.floor(a.cap+1e-9));   // cap: at most n units carry it; a new one pushes out the one renewed longest ago
      for(let i=L.length-1;i>=0;i--) if(!L[i].alive||!markOf(u,L[i],name)) L.splice(i,1);
      const j=L.indexOf(t); if(j>=0) L.splice(j,1); else while(L.length>=n){ const o=L.shift(); clearMark(u,o,name); } L.push(t); }
    const M=t._talM||(t._talM={}), o=M[u.uid]||(M[u.uid]={}), prev=o[name];
    const live=prev&&(prev.until==null||now<prev.until);                     // marking the same unit again keeps the mark's age
    let until=a.dur!=null?now+a.dur:null; if(a.longest&&live&&(prev.until==null||(until!=null&&prev.until>until))) until=prev.until;   // longest: a shorter mark never cuts a longer one
    o[name]={t0:live?prev.t0:now,until,v:prev?prev.v:0}; }
  function clearMark(u,t,name){ if(t&&t._talM&&t._talM[u.uid]) delete t._talM[u.uid][name]; }
  /* a mark with a clock that tells its owner when it is over: {mark, dur, while:'field of the holder that must stay above 0', ends:'event'}.
     The owner's tick ends it when the time is up or the field ran out first; {mark, clear:true, fire:true} ends it now. ctx.broke: it ended before
     its time (the field ran out, or a talent cut it). A holder that died is dropped silently. */
  function timedMark(T,u,t,name,a,ctx){ let d=amtOf(T,u,a.dur,ctx); if(!(d>0)) return;
    if(a.longest){ const m=markOf(u,t,name); if(m&&m.until!=null) d=Math.max(d,m.until-E.now()); }   // longest: a shorter one never cuts one that has longer to run (Absalie's Muffled)
    setMark(T,u,t,name,{dur:d,unique:a.unique}); const tm=T.s.tm;
    for(let i=0;i<tm.length;i++) if(tm[i].t===t&&tm[i].name===name){ tm[i].until=E.now()+d; tm[i].w=a.while||null; tm[i].ends=a.ends; return; }
    tm.push({t,name,until:E.now()+d,w:a.while||null,ends:a.ends}); }
  function endMark(T,u,t,name,fire,ctx){ const tm=T.s.tm; let e=null; for(let i=0;i<tm.length;i++) if(tm[i].t===t&&tm[i].name===name){ e=tm[i]; tm.splice(i,1); break; }
    const had=!!markOf(u,t,name); clearMark(u,t,name); if(fire&&e&&had&&e.ends&&T.on[e.ends]) run(T,u,e.ends,Object.assign({},ctx,{u,tgt:t,unit:t,broke:true})); }
  function tickMarks(T,u){ const tm=T.s.tm, now=E.now(); for(let i=0;i<tm.length;i++){ const e=tm[i], t=e.t; if(t.alive&&now<e.until-1e-9&&!(e.w&&!(t[e.w]>0))) continue;
      tm.splice(i--,1); const broke=now<e.until-1e-9; clearMark(u,t,e.name); if(t.alive&&e.ends&&T.on[e.ends]) run(T,u,e.ends,{u,tgt:t,unit:t,broke}); } }
  /* ---- ground zones: circles on the field that the owner's rows can ask about. T.s.zn[name] = [{x,y,r (pixels),until,centre}]. A unit is ON a zone
          when any part of its body is over it (centre:true: when its centre is inside, as the engine's own skill circles measure). No picture. ---- */
  const zoneAt=z=>{ if(z.f&&z.f.alive){ z.x=z.f.x; z.y=z.f.y; } };            // a zone that follows a unit (Astra's Bright Nebula) stands where that unit stands; where it fell once it dies
  function inZone(T,x,name){ const L=T.s.zn[name]; if(!L||!x) return false; const now=E.now();
    for(let i=0;i<L.length;i++){ const z=L[i]; if(now>=z.until) continue; zoneAt(z); const d=Math.hypot(x.x-z.x,x.y-z.y); if(z.centre?(d<z.r):(d-E.bodyR(x)<z.r)) return true; } return false; }
  /* zones with an end event ({zone, ends:'event'}): the owner's tick fires it once when the zone's time is up. ctx.pt = where it stood, ctx.o.radius = its radius */
  function zoneEnds(T,u){ const now=E.now(); for(const k in T.s.zn){ const L=T.s.zn[k]; for(let i=0;i<L.length;i++){ const z=L[i]; if(!z.ends||now<z.until) continue; L.splice(i--,1); zoneAt(z);
        if(T.on[z.ends]) run(T,u,z.ends,{u,tgt:u.target,pt:{x:z.x,y:z.y,pt:true},o:{radius:z.r},zone:k}); } } }
  /* trap zones ({zone, catch:'event', uses:n, who:<selector>}): each tick, the first `uses` units of `who` (default every enemy) found on the zone each set off its
     event once (ctx.tgt = that unit, ctx.pt = the zone's centre, ctx.o.radius = its radius); then it closes. Absalie's Empty Place (Hungry Gap: two) */
  function zoneCatch(T,u){ const now=E.now(); let live=false;
    for(const k in T.s.zn){ const L=T.s.zn[k]; for(let i=0;i<L.length;i++){ const z=L[i]; if(!z.catch||now>=z.until) continue; zoneAt(z); const us=pick(T,u,z.who,{u});
        for(let j=0;j<us.length&&z.left>0;j++){ const x=us[j]; if(z.got.indexOf(x.uid)>=0) continue; const d=Math.hypot(x.x-z.x,x.y-z.y); if(!(z.centre?(d<z.r):(d-E.bodyR(x)<z.r))) continue;
          z.got.push(x.uid); z.left--; if(T.on[z.catch]) run(T,u,z.catch,{u,tgt:x,unit:x,pt:{x:z.x,y:z.y,pt:true},o:{radius:z.r},zone:k}); }
        if(z.left<=0) z.until=now; else live=true; } }
    T.s.zc=live; }
  /* recorded places: a mark may carry a spot ({mark, spot:'here' | 'pt' | 'pt:<skill>', awayFor}). away: the unit carries one of those marks and its centre is more than
     m metres from that mark's spot (or the mark says it counts as away until awayFor runs out). Astra's Recorded / Out of Place */
  function away(T,u,x,v){ if(!x||!v) return false; const L=Array.isArray(v.mark)?v.mark:[v.mark], now=E.now(), lim=(v.m||0)*E.METER();
    for(let i=0;i<L.length;i++){ const m=markOf(u,x,L[i]); if(!m) continue; if(m.aw!=null&&now<m.aw) return true; if(m.sx!=null&&Math.hypot(x.x-m.sx,x.y-m.sy)>lim) return true; } return false; }
  function spotOf(u,t,names){ const L=Array.isArray(names)?names:[names]; for(let i=0;i<L.length;i++){ const m=markOf(u,t,L[i]); if(m&&m.sx!=null) return {x:m.sx,y:m.sy}; } return null; }
  const zoneOn=(T,name)=>{ const L=T.s.zn[name]; if(!L) return false; const now=E.now(); for(let i=0;i<L.length;i++) if(now<L[i].until) return true; return false; };
  const ptRef=(T,ctx,o)=>o==='pt'?((ctx&&ctx.pt)||null):(typeof o==='string'&&o.slice(0,3)==='pt:')?(T.s.pt[o.slice(3)]||null):undefined;   // 'pt': the point the event is about; 'pt:<skill>': where that skill of hers last landed
  const myDot=(u,d,tag)=>d._talO===u.uid&&(tag===true||d._talK===tag)&&d.remaining>0;   // tag true: any DoT of hers (her skills' DoTs she tagged, and her talents')
  function hasDot(u,t,tag){ if(!t||!t.dots) return false; for(let i=0;i<t.dots.length;i++) if(myDot(u,t.dots[i],tag)) return true; return false; }
  function countDots(u,tag){ let n=0; const U=E.units(); for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||!x.dots) continue; for(let j=0;j<x.dots.length;j++) if(myDot(u,x.dots[j],tag)) n++; } return n; }

  /* ---- how many (the `per` of a row, the `x` of an amount): 'stackName' | 'windowName' | 'spent' | {stack} | {window} | {markAge,every} | {dots}
          | {roll,step}, each with an optional max ---- */
  function cnt(T,u,per,ctx){ if(per==null) return 1;
    if(typeof per==='string'){ if(per==='spent') return ctx?(ctx.spent||0):0; if(T.st[per]) return stGet(T,per); const w=T.s.w[per]; return (w&&w.t>0)?w.n:0; }
    let n=0;
    if(per.stack){ n=Array.isArray(per.stack)?per.stack.reduce((a,k)=>a+stGet(T,k),0):stGet(T,per.stack); if(per.missing) n=Math.max(0,stMax(T,u,per.stack)-n); if(per.over!=null) n=Math.max(0,n-per.over);   // a list: those stacks together (Aldren's written Field Notes and his Field Kit ones); missing: how many short of full; over: how many above that count
      if(per.frac){ const m=stMax(T,u,per.stack); n=(m>0&&m<Infinity)?Math.floor(n/m*per.frac+1e-9):0; }   // frac: whole tenths (frac:10) of the pool that are filled
      if(per.div) n=Math.floor(n/per.div+1e-9); }                                  // div: whole multiples of that (every 3 m)
    else if(per.ust) n=per.of==='field'?ustField(T,u,per.ust):ustGet(T,u,per.of==='unit'?(ctx&&ctx.unit):per.of==='source'?(ctx&&ctx.src):(ctx&&ctx.tgt),per.ust);   // a unit stack: on the target, or on every enemy of the field
    else if(per.window){ const w=T.s.w[per.window]; n=(w&&w.t>0)?w.n:0; }
    else if(per.markAge){ const m=markOf(u,ctx&&ctx.tgt,per.markAge); n=m?Math.floor((E.now()-m.t0)/(per.every||1)+1e-9):0; }
    else if(per.dots) n=countDots(u,per.dots);
    else if(per.field){ const x=per.of==='self'?u:per.of==='unit'?(ctx&&ctx.unit):per.of==='source'?(ctx&&ctx.src):(ctx&&ctx.tgt); n=x?(+x[per.field]||0):0; }
    else if(per.units) n=pick(T,u,per.units,ctx).length;
    else if(per.roll){ const q=T.s.roll[per.roll]; let sum=0; if(q){ const t0=E.now()-q.span; for(let i=0;i<q.e.length;i++) if(q.e[i][0]>t0) sum+=q.e[i][1]; } const st=amtOf(T,u,per.step,ctx); n=st>0?Math.floor(sum/st+1e-9):0; }
    if(per.max!=null) n=Math.min(per.max,n); return n; }

  /* ---- an amount: number | {flat, pct, of, x} | {opt:'name of an option of the skill being cast', d: fallback}
          of: maxHp | hp | armor | atk (a basic attack's damage now) | shield | hit (the hit as it landed) | hpLost | overkill | over (overheal)
              | spent (what the enclosing spend / divert / damage took) | lifesteal (what the running lifesteal buff healed off this hit) */
  function baseOf(T,u,of,ctx){ switch(of){
    case 'maxHp': return u.maxHp||0; case 'hp': return Math.max(0,u.hp||0); case 'armor': return u.armorRating||0; case 'shield': return u.shield||0;
    case 'apow': return (u.apow||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1);                 // ability power now (with a running damage buff, as the hero's own skills read it)
    case 'tgtMaxHp': return (ctx&&ctx.tgt)?(ctx.tgt.maxHp||0):0;                          // the target's max HP (an ally's shield sized on the ally)
    case 'atk': return (u.dmg||0)*((u.dmgBuffT>0)?(u.dmgBuffMul||1):1)*E.rage();
    case 'hit': return ctx?(ctx.amt||0):0; case 'hpLost': return ctx?(ctx.hpLost||0):0; case 'overkill': return ctx?(ctx.overkill||0):0;
    case 'over': return ctx?(ctx.over||0):0; case 'spent': return ctx?(ctx.spent||0):0;
    case 'heal': return ctx?(ctx.heal||0):0;                                              // a heal of hers as it was offered (after her talents and healing power, before the room left)
    case 'lastHeal': return T.s.lh||0;                                                    // the last heal her skill gave one ally, as the skill computed it (before talents and healing power)
    case 'pitch': return ctx?(ctx.raw||0)*E.pitch(u,T.s.cur==='symphony'):0;             // Perfect Pitch's shield for this heal, as the skill writes it
    case 'tgtShield': return (ctx&&ctx.tgt)?(ctx.tgt.shield||0):0;
    case 'lifesteal': return ctx?(ctx.hpLost||0)*((u._lifestealT>0)?(u._lifestealPct||0):0):0;
    case 'dmg': return u.dmg||0;                                                          // her Attack stat as it stands (no running buff, no Blood Rage of the fight)
    case 'passMul': return u.passMul||1;                                                  // her passive's strength at its skill level (the engine's own multiplier)
    case 'gap': return (ctx&&ctx.tgt)?Math.max(0,gap(u,ctx.tgt))/E.METER():0;              // metres between her body and the target's
    case 'a0': return ctx?(ctx.a0||0):0;                                                 // a heal on a watched unit as it reached the talent rows
    case 'cut': return ctx?Math.max(0,(ctx.a0||0)-(ctx.amt||0)):0;                       // what the rows before have cut from that heal
    case 'raw': return ctx?(ctx.raw||0):0;                                               // an area skill's damage to each enemy as the skill computes it, before the target's resist (the at hook)
    case 'was': return ctx?(ctx.was||0):0;                                               // the engine number before the engine changed it (the pages Aldren held before a spell wrote one)
    default: return 0; } }
  function amtOf(T,u,a,ctx){ if(typeof a==='number') return a; if(!a) return 0;
    if(a.left){ const x=a.of==='unit'?(ctx&&ctx.unit):(ctx&&ctx.tgt), m=markOf(u,x,a.left); return (m&&m.until!=null)?Math.max(0,m.until-E.now()):0; }   // left: the seconds that mark of hers has left on that unit
    if(a.opt) return ((ctx&&ctx.o&&typeof ctx.o[a.opt]==='number'&&ctx.o[a.opt])||a.d||0)*(a.mul==null?1:a.mul);
    if(a.field||a.units||a.stack||a.ust) return cnt(T,u,a,ctx);
    let x=(a.flat||0)+(a.pct?a.pct*baseOf(T,u,a.of,ctx):0); if(a.x!=null) x*=cnt(T,u,a.x,ctx); if(a.k&&ctx&&ctx.k!=null) x*=ctx.k;
    if(a.split!=null){ const n=cnt(T,u,a.split,ctx); x=n>0?x/n:0; }                      // split: shared evenly between that many (none: nothing)
    return x; }
  /* his summons (Aldren): the units his summon hook gave his rows (x._talS = him), living, in the order he called them */
  function mineOf(T,u){ const L=T.s.sm; for(let i=L.length-1;i>=0;i--) if(!L[i].alive||L[i]._talS!==u) L.splice(i,1); return L; }
  const isMine=(u,x,v)=>!!x&&x._talS===u&&(v===true||x.key===v);                      // (alive or not: a death row asks about the one that just fell)

  /* ---- who: 'self' | 'target' | 'source' | 'unit' | 'holder:<mark>' | {team:'enemy'|'ally', of:'self'|'target'|'unit'|'source', within: metres,
          withinOpt:'radius', n, skipN, skip:'target'|'unit'|'self', others:true, order:'near'|'lowHp', has:'mark', hpBelow, fearedBy:true, centre:true}
          DISTANCE: `within` is measured BODY TO BODY (the gap between the two units' bodies). A hero's body is 1.6 to 2 m in radius, so two units
          that touch are about 3.6 m apart centre to centre: "within 3 m" measured between centres would hold nobody. `withinOpt` (the radius of the
          skill being cast) and `centre:true` measure centre to centre, as the engine's own skills do. ---- */
  function pick(T,u,sel,ctx){
    if(sel==null||sel==='target') return (ctx&&ctx.tgt)?[ctx.tgt]:[]; if(sel==='self') return [u];
    if(sel==='source') return (ctx&&ctx.src)?[ctx.src]:[]; if(sel==='unit') return (ctx&&ctx.unit)?[ctx.unit]:[];
    if(sel==='lastHit'){ const b=ctx&&ctx.tgt&&ctx.tgt._talBy; return (b&&b.alive&&b.team!==u.team)?[b]:[]; }       // the enemy that last hit the unit the event is about
    if(sel==='lowestAlly'){ const x=E.lowestAlly(u); return x?[x]:[]; }                 // the ally the engine itself picks as the most wounded (Harmony's centre)
    if(sel==='densest'){ const p=E.densest(u,(ctx&&ctx.o&&ctx.o.radius)||4*E.METER()); return p?[{x:p.x,y:p.y,pt:true}]:[]; }   // the point the engine's own densest-group pick chooses for the skill's radius (Absalie's Wide Knot)
    if(typeof sel==='string'){ if(sel.slice(0,7)==='holder:'){ const nm=sel.slice(7), h=T.s.m[nm]; return (h&&h.alive&&markOf(u,h,nm))?[h]:[]; } const p=ptRef(T,ctx,sel); return p?[p]:[]; }
    const ref=o=>{ const p=ptRef(T,ctx,o); if(p!==undefined) return p; return o==='target'?(ctx&&ctx.tgt):o==='unit'?(ctx&&ctx.unit):o==='source'?(ctx&&ctx.src):o==='self'?u:null; };
    const c=ref(sel.of||'self'); if(!c) return []; const cb=c.pt?0:E.bodyR(c);   // a point (where a skill landed) has no body
    const skip=sel.skip?ref(sel.skip):null, foe=sel.team!=='ally'&&sel.mine==null;
    const R=sel.within!=null?sel.within*E.METER():(sel.withinOpt?(((ctx&&ctx.o&&ctx.o[sel.withinOpt])||0)+(sel.withinAdd||0)*E.METER()):Infinity);   // withinAdd: metres beyond the skill's own reach
    const sb=sel.seg?(ctx&&ctx.tgt):null; if(sel.seg&&!sb) return [];                // seg: the units whose body the straight line from `of` to the target crosses (within: metres of slack)
    const out=[], U=sel.mine!=null?mineOf(T,u).slice():E.units();                    // mine: only his own summons (true: any; or that summon's key)
    for(let i=0;i<U.length;i++){ const x=U[i]; if(!x.alive||x===skip||x._dropHidden||x._noTarget) continue;
      if(foe?(x.team===u.team):(x.team!==u.team)) continue;
      if(sel.mine!=null){ if(!isMine(u,x,sel.mine)) continue; }
      else if(!foe&&(x._summon||(sel.others&&x===u))) continue;
      if(sel.has&&!markOf(u,x,sel.has)) continue;
      if(sel.lacks&&markOf(u,x,sel.lacks)) continue;
      if(sel.ust){ let okU=true; for(const k in sel.ust) if(ustGet(T,u,x,k)<sel.ust[k]) okU=false; if(!okU) continue; }   // carries at least that many of her unit stacks
      if(sel.ctrl&&!CLEANSE.some(f=>(x[f]||0)>0)) continue;                         // is under a control effect
      if(sel.boss!=null&&isBoss(x)!==sel.boss) continue;
      if(sel.below){ let okB=true; for(const f in sel.below) if(!((+x[f]||0)<sel.below[f])) okB=false; if(!okB) continue; }
      if(sel.min&&!fmin(x,sel.min)) continue;
      if(sel.inZone&&!inZone(T,x,sel.inZone)) continue;
      if(sel.hpBelow!=null&&!(x.hp<sel.hpBelow*x.maxHp)) continue;
      if(sel.dot!=null&&!hasDot(u,x,sel.dot)) continue;                              // carries a DoT of hers (true: any)
      if(sel.away&&!away(T,u,x,sel.away)) continue;                                  // away from a place she recorded for it
      if(sel.cast!=null&&!casts(x,sel.cast)) continue;                               // has a cast under way ('spell': a Green or Blue ability, 'ult', true: either)
      if(sel.seg){ if(!(segDist(x,c,sb)-E.bodyR(x)<R)) continue; out.push([x,E.dist(c,x)]); continue; }
      if(sel.fearedBy&&!((x.fearT||0)>0&&x._fearFrom===u)) continue;
      const d=E.dist(c,x); if(!((sel.withinOpt||sel.centre)?(d<R):(x===c||d-cb-E.bodyR(x)<R))) continue; out.push([x,d]); }
    const od=typeof sel.order==='string'?sel.order:'';
    if(od==='lowHp') out.sort((a,b)=>a[0].hp-b[0].hp);
    else if(od==='lowMax') out.sort((a,b)=>(a[0].maxHp||0)-(b[0].maxHp||0));        // the most fragile first (the lowest max HP, as Hookline itself ranks them)
    else if(od.slice(0,5)==='high:'){ const f=od.slice(5); out.sort((a,b)=>(+b[0][f]||0)-(+a[0][f]||0)); }              // the highest engine number first ('high:dmg': the highest attack)
    else if(od==='strong') out.sort((a,b)=>Math.max(+b[0].dmg||0,+b[0].apow||0)-Math.max(+a[0].dmg||0,+a[0].apow||0));   // the strongest first: the higher of attack and ability power
    else if(od.slice(0,5)==='most:'){ const nm=od.slice(5); out.sort((a,b)=>ustGet(T,u,b[0],nm)-ustGet(T,u,a[0],nm)); }   // the most of her unit stacks first
    else if(od==='near'||sel.n) out.sort((a,b)=>a[1]-b[1]);   // stable: ties keep the units' own order
    const from=sel.skipN||0; return (sel.n?out.slice(from,from+sel.n):out.slice(from)).map(e=>e[0]); }

  function segDist(p,a,b){ const dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy; let k=L>0?((p.x-a.x)*dx+(p.y-a.y)*dy)/L:0; k=Math.max(0,Math.min(1,k)); return Math.hypot(p.x-(a.x+dx*k),p.y-(a.y+dy*k)); }
  /* ---- conditions (the `if` of a row or of an action; all must hold) ---- */
  const COND={
    auto:(T,u,v,c)=>!!c.auto===v,                         // a basic attack
    crit:(T,u,v,c)=>!!c.crit===v,
    skill:(T,u,v,c)=>c.skill===v,                         // the skill being cast (its effect type string)
    tag:(T,u,v,c)=>c.tag===v,                             // the DoT's tag
    cc:(T,u,v,c)=>v.indexOf(c.field)>=0,                  // the control's field: 'stunned','fearT','slow','silencedT'
    who:(T,u,v,c)=>{ const x=c.unit; if(!x) return false; return v==='self'?x===u:(v==='ally'?(x.team===u.team&&x!==u&&!x._summon):x.team!==u.team); },
    unitHas:(T,u,v,c)=>!!markOf(u,c.unit,v),
    targetHas:(T,u,v,c)=>!!markOf(u,c.tgt,v),
    srcHas:(T,u,v,c)=>!!markOf(u,c.src,v),
    holderAlive:(T,u,v)=>{ const h=T.s.m[v]; return !!(h&&h.alive&&markOf(u,h,v)); },
    targetDot:(T,u,v,c)=>hasDot(u,c.tgt,v),
    anyDot:(T,u,v)=>countDots(u,v)>0,
    targetTeam:(T,u,v,c)=>!!c.tgt&&((c.tgt.team!==u.team)===(v==='enemy')),
    srcTeam:(T,u,v,c)=>!!c.src&&((c.src.team!==u.team)===(v==='enemy')),
    srcMelee:(T,u,v,c)=>!!c.src&&(!!c.src.melee===v),
    targetHpBelow:(T,u,v,c)=>!!c.tgt&&c.tgt.hp<v*c.tgt.maxHp,
    selfHpBelow:(T,u,v)=>u.hp<v*u.maxHp,
    selfHpAbove:(T,u,v)=>u.hp>v*u.maxHp,
    stackMin:(T,u,v)=>{ for(const k in v) if(stGet(T,k)<v[k]) return false; return true; },
    stackFull:(T,u,v)=>{ const n=stGet(T,v); return n>0&&n>=stMax(T,u,v)-1e-9; },
    stackEmpty:(T,u,v)=>!(stGet(T,v)>0),
    window:(T,u,v)=>winOn(T,v),
    noWindow:(T,u,v)=>!winOn(T,v),
    hitMin:(T,u,v,c)=>(c.amt||0)>=amtOf(T,u,v,c),         // the hit, as it is about to land / as it landed
    lostMin:(T,u,v,c)=>(c.hpLost||0)>=amtOf(T,u,v,c),     // the HP it took off
    lostBelow:(T,u,v,c)=>(c.hpLost||0)<amtOf(T,u,v,c),
    overMin:(T,u,v,c)=>(c.over||0)>v,
    moved:(T,u,v)=>T.s.moved===v,
    casting:(T,u,v)=>Array.isArray(v)?v.indexOf(T.s.cur)>=0:T.s.cur===v,   // the skill of his that is resolving right now (null: none - a basic attack, a channel's tick)
    srcFlag:(T,u,v,c)=>!!(c.src&&c.src[v]),                 // an engine flag on the attacker for this hit ('_frostHit': a frost ability)
    selfPass:(T,u,v)=>!!(u.pass&&u.pass[v]),                // the hero's passive is unlocked
    targetMin:(T,u,v,c)=>fmin(c.tgt,v), unitMin:(T,u,v,c)=>fmin(c.unit,v), srcMin:(T,u,v,c)=>fmin(c.src,v),   // an engine counter on that unit: {field: at least}
    targetIn:(T,u,v,c)=>inZone(T,c.tgt,v),                  // the target stands on one of his ground zones of that name
    zone:(T,u,v)=>zoneOn(T,v),                              // a ground zone of that name is down
    targetLacks:(T,u,v,c)=>!markOf(u,c.tgt,v),
    noHolder:(T,u,v)=>{ const h=T.s.m[v]; return !(h&&h.alive&&markOf(u,h,v)); },
    targetHpAbove:(T,u,v,c)=>!!c.tgt&&c.tgt.hp>v*c.tgt.maxHp,
    srcIs:(T,u,v,c)=>{ const x=c.src; if(!x) return false; return v==='self'?x===u:(v==='ally'?(x.team===u.team&&x!==u):x.team!==u.team); },
    srcWithin:(T,u,v,c)=>!!c.src&&gap(u,c.src)<v*E.METER(), srcBeyond:(T,u,v,c)=>!!c.src&&gap(u,c.src)>v*E.METER(),   // body to body, from the owner
    broke:(T,u,v,c)=>!!c.broke===v,                         // how a timed mark ended: its field ran out (or a talent cut it) before its time
    talent:(T,u,v,c)=>!!c.talent===v,                       // the control comes from a talent action (not from a skill of the hero)
    some:(T,u,v,c)=>pick(T,u,v,c).length>0,                 // at least one unit matches the selector
    targetWithin:(T,u,v,c)=>!!c.tgt&&gap(u,c.tgt)<v*E.METER(), unitWithin:(T,u,v,c)=>!!c.unit&&gap(u,c.unit)<v*E.METER(),
    kind:(T,u,v,c)=>c.kind===v,                             // the hit's damage kind ('magic', 'phys')
    hot:(T,u,v,c)=>!!c.hot===v,                             // the heal is a tick of a heal over time (not the skill's own heal)
    p:(T,u,v)=>!!T.P[v],                                    // a named number some learned talent adds to (a row that only matters when one of them is learned)
    targetUst:(T,u,v,c)=>{ for(const k in v) if(ustGet(T,u,c.tgt,k)<v[k]) return false; return true; },   // the target carries at least that many of her unit stacks
    targetIs:(T,u,v,c)=>!!c.tgt&&pick(T,u,v,c).indexOf(c.tgt)>=0,   // the target is one of the units the selector picks ("the lowest-HP Listening ally")
    atLeast:(T,u,v,c)=>pick(T,u,v.of,c).length>=v.n,       // at least n units match
    none:(T,u,v,c)=>pick(T,u,v,c).length===0,               // no unit matches
    hero:(T,u,v,c)=>!!c.tgt&&!c.tgt._summon===v,            // the target is a hero, not a summon
    any:(T,u,v,c)=>v.some(x=>ok(T,u,x,c)),                  // at least one of these condition sets holds ("Snagged or Blindsided")
    np:(T,u,v)=>!T.P[v],                                    // no learned talent adds to that named number (a fork that switches a behaviour off)
    selfMin:(T,u,v)=>fmin(u,v),                             // an engine counter on the owner: {field: at least}
    unitUst:(T,u,v,c)=>{ for(const k in v) if(ustGet(T,u,c.unit,k)<v[k]) return false; return true; },
    unitDot:(T,u,v,c)=>hasDot(u,c.unit,v),                  // the unit the event is about carries a DoT of hers
    targetRow:(T,u,v,c)=>!!(c.tgt&&c.tgt.t&&c.tgt.t.row===v), // the game's own combat row of that hero ('Back'); a monster has none
    targetAlive:(T,u,v,c)=>!!c.tgt&&!!c.tgt.alive===v,     // the target still stands (a strike may have killed it)
    tgtNone:(T,u,v,c)=>!c.tgt===v,                          // the skill found no target
    dropBelow:(T,u,v,c)=>u.hp>=v*u.maxHp&&(u.hp+(u.shield||0)-(c.amt||0))<v*u.maxHp,   // this hit, as it reaches her (after armor, through her shield), would take her below that share
    srcDot:(T,u,v,c)=>hasDot(u,c.src,v),                    // the attacker carries a DoT of hers ("burning enemies")
    targetAway:(T,u,v,c)=>away(T,u,c.tgt,v), unitAway:(T,u,v,c)=>away(T,u,c.unit,v), srcAway:(T,u,v,c)=>away(T,u,c.src,v),   // {mark, m}: away from the place she recorded for it
    targetUstBelow:(T,u,v,c)=>{ for(const k in v) if(!(ustGet(T,u,c.tgt,k)<v[k])) return false; return true; },   // the target carries fewer than that many of her unit stacks
    srcUst:(T,u,v,c)=>{ for(const k in v) if(ustGet(T,u,c.src,k)<v[k]) return false; return true; },     // the attacker carries at least that many of her unit stacks
    targetCast:(T,u,v,c)=>casts(c.tgt,v),                   // the target has a cast under way ('spell' | 'ult' | true)
    targetMore:(T,u,v,c)=>!!c.tgt&&(+c.tgt[v]||0)>(+u[v]||0),   // the target's engine number is higher than hers ('apow': more ability power than Absalie)
    /* his summons (Aldren): true = any of his, or a summon's key ('ink spirit', 'ink horror') */
    unitMine:(T,u,v,c)=>isMine(u,c.unit,v), targetMine:(T,u,v,c)=>isMine(u,c.tgt,v), srcMine:(T,u,v,c)=>isMine(u,c.src,v),
    mine:(T,u,v)=>{ const L=mineOf(T,u); for(let i=0;i<L.length;i++) if(v===true||L[i].key===v) return true; return false; },   // a summon of his (of that key) stands
    unitExtra:(T,u,v,c)=>!!(c.unit&&c.unit._talEx)===v,     // a summon his talents called (not his Ink Spirit skill)
    unitKey:(T,u,v,c)=>!!c.unit&&c.unit.key===v, srcKey:(T,u,v,c)=>!!c.src&&c.src.key===v,   // which kind of unit ('ink spirit', 'ink horror')
    selfBelow:(T,u,v)=>{ for(const f in v) if(!((+u[f]||0)<v[f])) return false; return true; },   // an engine counter on the owner below that ({_pages:1}: he holds no Living Page)
    wasBelow:(T,u,v,c)=>(c.was||0)<v,                      // the engine number before the engine changed it (pageW: the pages he held before the spell)
    fn:(T,u,v,c)=>!!T.fn[v](API,T,u,c)
  };
  const fmin=(x,v)=>{ if(!x) return false; for(const f in v) if(!((+x[f]||0)>=v[f])) return false; return true; };
  /* a cast under way: the engine's pending cast (u._pend, from the press until it releases; a silence, stun or fear cancels it). spell: a Green or Blue ability (castKit), ult: an ultimate */
  const casts=(x,v)=>{ const p=x&&x._pend; if(!p) return false; return v==='spell'?!!p.spell:v==='ult'?!p.spell:true; };
  const gap=(a,b)=>E.dist(a,b)-E.bodyR(a)-E.bodyR(b);
  function ok(T,u,cond,ctx){ for(const k in cond){ const f=COND[k]; if(!f||!f(T,u,cond[k],ctx)) return false; } return true; }

  /* ---- a row at its event: conditions, limiters, then its modifiers and its actions ----
     limiters: edge (fires when `if` turns true) | period+rate (fires each `period` s the `if` has held; tick only) | once:'wave'|'fight' | uses:n
               | icd: seconds | every: n (each n-th time) | chance: p (the only place the seeded stream is drawn, and last, so nothing else changes how often) */
  const PROC_SKIP={out:1,hit:1,crit:1,heal:1};          // a row does not react to what the hero's own talent actions do, unless it says procs:true
  function run(T,u,ev,ctx){ const rows=T.on[ev]; if(!rows) return; const s=T.s;
    const st0=ctx.stop; if(st0) ctx.stop=false;           // an event set off after a row said "stop" (a save, then its 'encore') still runs all its rows; the stop is kept for the outer event
    try{ runRows(T,u,ev,ctx,rows,s); } finally{ if(st0) ctx.stop=true; } }
  function runRows(T,u,ev,ctx,rows,s){
    for(let i=0;i<rows.length;i++){ const row=rows[i]; const L0=s.lim[row.key]||(s.lim[row.key]={t:0,n:0,c:0,w:-1,was:false,acc:0,busy:0,by:null});
      if(L0.busy) continue;                               // never re-entered by its own consequences
      if(ctx.proc&&!row.procs&&PROC_SKIP[ev]) continue;
      if(ctx.viaDot&&!row.dots) continue;                 // a kill by a DoT tick counts only for rows that say dots:true
      if(row.skill&&ctx.skill!==row.skill) continue;
      /* each:<who> - the row is asked once for every such unit (it becomes the row's target) and keeps its limiters per unit;
         by:'source'|'target'|'unit' - one event, but the limiters are kept per that unit ("once per enemy every 4 s") */
      if(row.each){ const us=pick(T,u,row.each,ctx), by=L0.by||(L0.by={});
        for(let j=0;j<us.length;j++){ const x=us[j]; fire(T,u,row,ev,Object.assign({},ctx,{tgt:x}),by[x.uid]||(by[x.uid]={t:0,n:0,c:0,w:-1,was:false,acc:0}),L0); }
        continue; }
      let L=L0; if(row.by){ const x=row.by==='source'?ctx.src:row.by==='unit'?ctx.unit:ctx.tgt; if(!x) continue; const by=L0.by||(L0.by={}); L=by[x.uid]||(by[x.uid]={t:0,n:0,c:0,w:-1,was:false,acc:0}); }
      fire(T,u,row,ev,ctx,L,L0);
      if(ctx.stop) break; } }
  function fire(T,u,row,ev,ctx,L,L0){ const s=T.s;
      const pass=!row.if||ok(T,u,row.if,ctx);
      if(row.edge){ const was=L.was; L.was=pass; if(!pass||was) return; }
      else if(row.period){ if(!pass){ L.acc=0; return; } let rt=row.rate==null?1:row.rate;
        if(row.rateUp) for(let q=0;q<row.rateUp.length;q++){ const x=row.rateUp[q]; if(x.if&&!ok(T,u,x.if,ctx)) continue; rt+=x.add*(x.per!=null?cnt(T,u,x.per,ctx):1); }   // rateUp: the clock runs that much faster while each condition holds (or per stack)
        L.acc+=(ctx.dt||0)*rt; if(L.acc<row.period-1e-9) return; L.acc-=row.period; }
      else if(!pass) return;
      if(row.once==='wave'&&L.w===s.wave) return;
      if(row.once==='fight'&&L.n>0) return;
      if(row.uses&&L.n>=row.uses) return;
      if(row.icd&&E.now()<L.t) return;
      if(row.every){ if(++L.c<row.every) return; L.c=0; }
      if(row.chance!=null){ const p=typeof row.chance==='number'?row.chance:amtOf(T,u,row.chance,ctx); if(!(p>0)||!(E.rnd()<p)) return; }   // an amount: a chance the fight works out now (her dodge chance)
      L.n++; L.w=s.wave; if(row.icd) L.t=E.now()+row.icd;
      modify(T,u,row,ctx);
      if(row.do){ L0.busy=1; s.d++; try{ acts(T,u,row.do,ctx); } finally{ s.d--; L0.busy=0; } } }

  /* modifiers: change the number the event carries (damage, heal, cooldown, control seconds) or the options of the skill being cast */
  function modify(T,u,row,ctx){
    const n=(row.per!=null?cnt(T,u,row.per,ctx):1)*(row.scale==null?1:row.scale);
    const up=x=>row.upTo!=null?Math.min(row.upTo,x):x;                            // upTo: the share never above that, whatever the count ("up to 10%")
    if(row.more!=null) ctx.amt*=1+up(row.more*n);
    if(row.less!=null) ctx.amt*=Math.max(0,1-up(row.less*n));
    if(row.mul!=null) ctx.amt*=row.mul;
    if(row.add!=null) ctx.amt+=row.add*n;
    if(row.critMore!=null&&ctx.crit) ctx.amt*=1+row.critMore*n;
    if(row.ignoreArmor!=null&&ctx.kind==='phys'&&ctx.tgt&&ctx.src){ const src=ctx.src, a=E.defMul(src,ctx.tgt,'phys');
      if(a>0){ const sv=src._wpnArmIgn; src._wpnArmIgn=1-(1-(sv||0))*(1-Math.min(1,row.ignoreArmor*n)); const b=E.defMul(src,ctx.tgt,'phys'); src._wpnArmIgn=sv; ctx.amt*=b/a; } }
    if(row.ignoreMr!=null&&ctx.kind==='magic'&&ctx.tgt&&ctx.src){ const t=ctx.tgt, a=E.defMul(ctx.src,t,'magic');     // the hit ignores that share of the target's magic resist
      if(a>0){ const sv=t.mrRating; t.mrRating=(sv||0)*Math.max(0,1-row.ignoreMr*n); const b=E.defMul(ctx.src,t,'magic'); t.mrRating=sv; ctx.amt*=b/a; } }
    if(row.addM!=null) ctx.amt+=row.addM*n*E.METER();                              // metres, for a number the engine keeps in its own length unit
    if(row.divert!=null){ const cut=ctx.amt*Math.min(1,row.divert*n);            // the owner takes this share of the hit in the target's place
      if(cut>0){ ctx.amt-=cut; E.damage(u,cut,'#ffb37a',true); if(T.on.diverted) run(T,u,'diverted',Object.assign({},ctx,{spent:cut})); } }
    if(row.force) ctx.force=true;
    if(row.opt&&ctx.o) for(const k in row.opt){ const op=row.opt[k], m=op.per!=null?cnt(T,u,op.per,ctx):1; let v=ctx.o[k];
      if(op.set!=null) v=op.set;
      if(op.add!=null) v=(v||0)+op.add*m/(op.ccRaw?(E.ccDur(1)||1):1);       // ccRaw: seconds as the player gets them (the engine shortens every control afterwards)
      if(op.addM!=null) v=(v||0)+op.addM*m*E.METER();                           // metres, for an option the engine keeps in its own length unit (a reach)
      if(op.mul!=null) v=(v||0)*op.mul;
      if(op.more!=null) v=(v||0)*(1+op.more*m);                                  // more: x (1 + x per count) - "the shield is 1% larger per Bar"
      if(op.bonus!=null) v=1+((v||1)-1)*(1+op.bonus*m);                        // strengthens the part above 1 (a "+10%" multiplier of 1.1)
      ctx.o[k]=v; } }

  /* damage a talent itself deals: taken straight off the target (like a DoT tick: the stated amount, no second pass through Blood Rage,
     crit or lifesteal, and no seeded draw); the target's own shield and damage reduction still apply. Returns the HP it removed. */
  function hurt(T,u,t,a,color,tag){ if(!t||!t.alive||!(a>0)) return 0; const hp0=t.hp; E.damage(t,a,color||'#ffb37a',true);
    const lost=Math.max(0,hp0-Math.max(0,t.hp));
    if(!t.alive&&hp0>0&&T.on.kill) run(T,u,'kill',{u,src:u,tgt:t,amt:a,hpLost:lost,overkill:Math.max(0,-t.hp),proc:true,tag});
    return lost; }

  /* a control effect a talent states in seconds: shortened / lengthened by the same rows as any other control (ccIn of the one struck, ccOut of the owner),
     cut to the engine's cap, written straight onto the unit, then told to the owner's 'ccHit' rows (a control that landed) */
  function control(T,u,t,field,secs,asIs){ let d=asIs?secs:cc(u,t,field,secs,true); const cap=E.ccCap(field); if(cap&&d>cap) d=cap; if(!(d>0)) return;   // asIs: seconds copied from a control that already landed (no second pass through ccOut)
    t[field]=Math.max(t[field]||0,d); if(T.on.ccHit) run(T,u,'ccHit',{u,src:u,tgt:t,field,amt:d,talent:true}); }
  function acts(T,u,list,ctx){ for(let i=0;i<list.length;i++){ const a=list[i]; if(a.if&&!ok(T,u,a.if,ctx)) continue; if(act(T,u,a,ctx)===false) break; } }
  const CLEANSE=['stunned','fearT','silencedT','_sleepT','slow'];
  /* one of the engine's own timed buffs written on a unit: 'dmg' (dmgBuffMul / dmgBuffT: x = 0.05 is 5% more damage), 'haste' (hasteMul / hasteT: attack speed),
     'dr' (drMul / drT, the skill damage-reduction slot where the strongest one counts: x = the share taken off), 'crit' (_critBuffPct / _critBuffT: chance added).
     A weaker buff never replaces a stronger one that is still running (and never lengthens it); a stronger one replaces it with its own time. */
  const BUFF={dmg:['dmgBuffMul','dmgBuffT'],haste:['hasteMul','hasteT'],dr:['drMul','drT'],crit:['_critBuffPct','_critBuffT']};
  function buffOn(t,k,x,d){ const F=BUFF[k]; if(!F||!(x>0)||!(d>0)) return false; const v=k==='dr'?Math.max(0.05,1-x):k==='crit'?x:1+x, on=(t[F[1]]||0)>0, cur=t[F[0]];
    if(on&&cur!=null&&(k==='dr'?!(v<cur):!(v>cur))) return false; t[F[0]]=v; t[F[1]]=d; return true; }
  function act(T,u,a,ctx){ const s=T.s;
    if(a.after!=null){ s.dq.push({t:E.now()+amtOf(T,u,a.after,ctx),list:a.do||[],ctx:Object.assign({},ctx)}); return; }   // after: these actions that many seconds from now (the owner's tick runs them, with this event's context)
    if(a.stack){ const have=stGet(T,a.stack);
      if(a.spend!=null){ const n=a.spend==='all'?have:a.spend; if(a.spend!=='all'&&have<n) return false; if(!(n>0)) return;
        stSet(T,u,a.stack,have-n); if(a.then) acts(T,u,a.then,Object.assign({},ctx,{spent:n})); return; }
      if(a.touch){ const k=s.k[a.stack], d=T.st[a.stack]; if(k&&k.n>0&&d&&d.dur) k.t=d.dur; return; }
      if(a.refillIn!=null){ const k=s.k[a.stack]; if(k&&k.rf){ const at=E.now()+a.refillIn; for(let i=0;i<k.rf.length;i++) if(k.rf[i]>at) k.rf[i]=at; } return; }   // every spent unit comes back that soon
      if(a.set!=null){ stSet(T,u,a.stack,a.set==='max'?stMax(T,u,a.stack):amtOf(T,u,a.set,ctx)); return; }
      if(a.keep!=null){ const n=have*Math.max(0,Math.min(1,a.keep)); stSet(T,u,a.stack,a.whole?Math.floor(n+1e-9):n); return; }   // keep that share (whole: rounded down)
      if(a.atLeast!=null){ const x=amtOf(T,u,a.atLeast,ctx); if(have<x) stSet(T,u,a.stack,x); return; }
      const got=stSet(T,u,a.stack,have+amtOf(T,u,a.add==null?1:a.add,ctx));
      if(got>0){ const g=(T.st[a.stack]||{}).gain; if(g&&T.on[g]) run(T,u,g,Object.assign({},ctx,{k:got})); }   // the state's gain event (k = how many came: Absalie's Gap Feeding heals per Word)
      if(a.full&&got>0&&stGet(T,a.stack)>=stMax(T,u,a.stack)-1e-9) acts(T,u,a.full,ctx);
      return; }
    if(a.mark){ const ts=pick(T,u,a.on,ctx); for(const t of ts){ if(a.clear){ if(a.fire!=null) endMark(T,u,t,a.mark,a.fire,ctx); else clearMark(u,t,a.mark); }
        else if(a.ends||a.while) timedMark(T,u,t,a.mark,a,ctx);
        else { const had=a.added?!!markOf(u,t,a.mark):true; setMark(T,u,t,a.mark,typeof a.dur==='object'?Object.assign({},a,{dur:amtOf(T,u,a.dur,ctx)}):a);
          if(a.spot||a.awayFor!=null){ const m=markOf(u,t,a.mark); if(m){ const p=a.spot==='here'?t:(a.spot?pick(T,u,a.spot,ctx)[0]:null); if(p){ m.sx=p.x; m.sy=p.y; }   // spot: the place recorded with the mark ('here': where the unit stands now)
              if(a.awayFor!=null) m.aw=E.now()+amtOf(T,u,a.awayFor,ctx); } }                                                                                  // awayFor: it counts as away from that place for so long
          if(!had&&T.on[a.added]) run(T,u,a.added,Object.assign({},ctx,{tgt:t})); } } return; }   // added: an event when the unit did not carry it before (newly on her list)
    if(a.zone){ const L=s.zn[a.zone]||(s.zn[a.zone]=[]);
      const at=a.at||'target', c=typeof at==='object'?{x:u[at.x],y:u[at.y]}:pick(T,u,at,ctx)[0]; if(!c||c.x==null) return;
      const now=E.now(); for(let i=L.length-1;i>=0;i--) if((a.only||now>=L[i].until)&&!L[i].ends) L.splice(i,1); if(L.length>=24) L.shift();   // only: this one replaces the ones still down (a zone with an end event stays until its tick fires it)
      const z={x:c.x,y:c.y,r:a.radiusPx!=null?amtOf(T,u,a.radiusPx,ctx):amtOf(T,u,a.radius,ctx)*E.METER(),until:now+amtOf(T,u,a.dur,ctx),centre:!!a.centre};   // radiusPx: a radius already in the engine's length unit (a skill's own `radius` option)
      if(a.follow){ const f=pick(T,u,a.follow,ctx)[0]; if(f&&f.uid!=null) z.f=f; } if(a.ends) z.ends=a.ends;   // follow: the zone moves with that unit; ends: its end event
      if(a.catch){ z.catch=a.catch; z.left=Math.max(1,Math.floor(amtOf(T,u,a.uses==null?1:a.uses,ctx)+1e-9)); z.got=[]; z.who=a.who||{team:'enemy'}; s.zc=true; }   // catch: a trap (see zoneCatch)
      L.push(z); return; }
    if(a.ustack){ const d=T.st[a.ustack]||{}, mx=d.max==null?Infinity:d.max, burst=[];
      if(a.touch){ const dd=a.dur!=null?amtOf(T,u,a.dur,ctx):undefined; for(const t of pick(T,u,a.on,ctx)){ const v=ustGet(T,u,t,a.ustack); if(v>0) ustPut(T,u,t,a.ustack,v,dd); } return; }   // touch: what it carries lapses again from now ("refreshed with the wound"); dur: that long from now (with `longest`: never sooner than it would have)
      for(const t of pick(T,u,a.on,ctx)){ if(!t.alive) continue;
        if(a.set!=null){ ustPut(T,u,t,a.ustack,a.set==='max'?mx:Math.min(mx,amtOf(T,u,a.set,ctx))); if(a.burst) burst.push(t); continue; }   // set (burst: then each one's `full` event, after all are set)
        if(a.lock&&markOf(u,t,a.lock)) continue;                                                       // lock: each unit at most once every lockDur seconds from this action
        const was=ustGet(T,u,t,a.ustack), add=amtOf(T,u,a.add==null?1:a.add,ctx); if(!(add>0)) continue;
        const lim=a.cap!=null?Math.min(mx,Math.max(a.cap,was)):mx, nw=Math.min(lim,was+add), got=nw-was; ustPut(T,u,t,a.ustack,nw,a.dur); if(a.lock) setMark(T,u,t,a.lock,{dur:a.lockDur||1});   // cap: this action fills it only up to n; dur: this gain's own lapse
        if(got>0){ const c2=Object.assign({},ctx,{tgt:t,k:got}); if(d.gain&&T.on[d.gain]) run(T,u,d.gain,c2); if(a.emit&&T.on[a.emit]) run(T,u,a.emit,c2); }
        if(nw>=mx) ustFull(T,u,t,d,ctx); }                                                             // "reaches 5": any gain that leaves it full
      for(const t of burst) ustFull(T,u,t,d,ctx); return; }
    /* her skills' own DoTs made hers ({tagDots:'kit'} on kit, {tagDots:'<tag>', exact, emit} on cast): the DoTs the skill pushed in between, with her as the source, carry her tag,
       so their ticks run her rows (dotOut, dotTick, kill by a DoT). exact: a duration the skill's options give in part-seconds ends on a part tick (the engine counts whole ticks).
       ctx.dot / ctx.tgt: the DoT tagged last and its holder (Bleed Them Dry's wound); emit: an event for each DoT tagged */
    if(a.tagDots&&a.last){ for(const t of pick(T,u,a.on,ctx)){ const D=t.dots, d=D&&D[D.length-1]; if(!d||d.src!==u||d._talO!=null) continue;   // last: the DoT her passive has just put on that unit (Astra's Stardust, pushed after the blow) becomes hers
        d._talO=u.uid; d._talK=a.tagDots; if(a.emit&&T.on[a.emit]) run(T,u,a.emit,Object.assign({},ctx,{tgt:t,dot:d})); } return; }
    if(a.tagDots){ if(a.tagDots==='kit'){ const al=[]; for(const x of E.units()) if(x.alive&&x.team!==u.team&&x.dots) al.push([x,x.dots.length]); s.dl=al; return; }
      const L=s.dl||[]; s.dl=null; for(const e of L){ const D=e[0].dots; for(let i=e[1];i<D.length;i++){ const d=D[i]; if(d.src!==u||d._talO!=null) continue; d._talO=u.uid; d._talK=a.tagDots;
          if(a.exact&&ctx.o&&ctx.o.dur>0){ const q=ctx.o.dur/(d.interval||1); if(Math.abs(q-Math.round(q))>1e-9){ d.remaining=Math.ceil(q-1e-9); d._talF=q-(d.remaining-1); } }
          ctx.dot=d; ctx.tgt=e[0]; if(a.emit&&T.on[a.emit]) run(T,u,a.emit,Object.assign({},ctx,{tgt:e[0],dot:d})); } } return; }
    if(a.dotAdd){ const d=ctx.dot; if(!d||!(d.remaining>0)) return; const n=d.remaining-1+(d._talF!=null?d._talF:1), x=amtOf(T,u,a.total,ctx); if(n>0&&x>0) d.dps+=x/n; return; }   // that much more over the DoT's ticks left
    if(a.burstDot){ const d=ctx.dot, h=ctx.tgt; if(!d||!(d.remaining>0)||!h) return; const rest=d.dps*(d.remaining-1+(d._talF!=null?d._talF:1)); const ts=pick(T,u,a.on,ctx);   // the rest of the DoT at once, to each unit picked; the DoT is over
      const i=h.dots.indexOf(d); if(i>=0) h.dots.splice(i,1); for(const t of ts) hurt(T,u,t,rest,a.color,a.tag); return; }
    if(a.copyDot){ const d=ctx.dot; if(!d||!(d.remaining>0)) return; const k=amtOf(T,u,a.scale==null?1:a.scale,ctx); if(!(k>0)) return;   // the same DoT again on another unit, at that strength, as hers
      for(const t of pick(T,u,a.on,ctx)){ if(!t.alive) continue; E.pushDot(t,d.dps*k,d.remaining*d.interval,d.interval,d.color,u,d.kind||'true'); const nd=t.dots[t.dots.length-1]; nd._talO=u.uid; nd._talK=a.copyDot; if(d._talF!=null) nd._talF=d._talF; } return; }
    if(a.untarget!=null){ const x=amtOf(T,u,a.untarget,ctx); if(x>0){ u._noTarget=true; u._noTargetT=Math.max(u._noTargetT||0,x); } return; }   // she cannot be targeted for that long (the engine's own untargetable state, as Hookline's evade)
    if(a.retarget){ const x=pick(T,u,a.retarget,ctx)[0]; if(x) ctx.tgt=x; return; }                // on skillTgt: the skill goes to that unit instead (when one is picked)
    if(a.miss){ ctx.amt=0; u._talMiss=1; return; }                                                // on 'in': this hit misses her (the page leaves the hit before any damage)
    if(a.dodge){ ctx.dodged=true; return; }                                                       // on 'dodge': she dodges this hit
    if(a.weaken){ const f=a.weaken, cur=u[f], m=s.wk||(s.wk={}); if(cur==null||!(cur<1)){ m[f]=null; return; } if(m[f]===cur) return;   // a control on her that much weaker (a slow's strength), once per new value
      u[f]=1-(1-cur)*Math.max(0,1-amtOf(T,u,a.by,ctx)); m[f]=u[f]; return; }
    if(a.damp){ const f=a.damp, by=Math.max(0,Math.min(1,amtOf(T,u,a.by,ctx))), m=s.dp||(s.dp={});   // an engine number on a unit made that share smaller, once per new value (a drag's speed: Absalie's Weighted Robe)
      for(const t of pick(T,u,a.on||'self',ctx)){ const cur=t[f], key=t.uid+':'+f; if(cur==null||!(cur>0)||m[key]===cur) continue; t[f]=cur*(1-by); m[key]=t[f]; } return; }
    if(a.restore){ for(const t of pick(T,u,a.on,ctx)) if(t.alive) t[a.restore]=ctx.was||0; return; }   // an engine timer back to what it was before her passive wrote it (ctx.was)
    if(a.later){ if(s.cur!=null) s.later.push([a.later,ctx]); else acts(T,u,a.later,ctx); return; }   // later: once the skill being cast has finished (its own shields written), else now
    if(a.tagHots){ const al=[]; for(const x of E.units()) if(x.alive&&x.team===u.team&&x.hots) al.push(x);   // the heals over time her skill is about to push / just pushed become hers (their ticks run her rows)
      if(a.tagHots==='kit'){ s.hl=al.map(x=>[x,x.hots.length]); return; }
      for(const e of (s.hl||[])){ const H=e[0].hots; for(let i=e[1];i<H.length;i++) if(!H[i]._talU){ H[i]._talU=u; H[i]._talK=a.tagHots; } } s.hl=null; return; }
    if(a.unhot){ for(const x of E.units()){ const H=x.hots; if(!H) continue; for(let i=H.length-1;i>=0;i--) if(H[i]._talX===u.uid&&H[i]._talK===a.unhot) H.splice(i,1); } return; }   // her talent's heal over time stops
    /* moving a unit: the engine's own drag (pulledBy / pullT / pullStop / pullSpeed, as Collapsing Star and Event Horizon set it); an immovable unit is not moved.
       to: 'pt' | 'pt:<skill>' | {spot:<mark name(s)>} (the place recorded with that mark). secs: over that long, m metres (all the way when left out);
       or speed: metres a second for secs ("drifts 0.2 m each second") */
    if(a.pull!=null){ const M=E.METER(); for(const t of pick(T,u,a.pull,ctx)){ if(!t.alive||t.immovable||(t._gearImmovableT||0)>0) continue;
        const p=(a.to&&a.to.spot)?spotOf(u,t,a.to.spot):pick(T,u,a.to,ctx)[0]; if(!p||p.x==null) continue; const dd=Math.hypot(p.x-t.x,p.y-t.y), tm=amtOf(T,u,a.secs,ctx)||0.3;
        if(a.speed!=null){ const v=amtOf(T,u,a.speed,ctx)*M; if(!(v>0)) continue; t.pullStop=0; t.pullSpeed=v; }
        else { const L=a.m!=null?Math.min(dd,amtOf(T,u,a.m,ctx)*M):dd; if(!(L>0)) continue; t.pullStop=dd-L; t.pullSpeed=Math.max(1,L/tm); }
        t.pulledBy={x:p.x,y:p.y,alive:true}; t.pullT=tm; t._pullGhost=false; } return; }
    if(a.extend){ const cap=E.ccCap(a.extend), by=amtOf(T,u,a.by,ctx); if(!(by>0)) return;      // a control already on the unit lasts that much longer (cut at the engine's cap)
      for(const t of pick(T,u,a.on,ctx)) if(t.alive&&(t[a.extend]||0)>0){ let v=t[a.extend]+by; if(cap&&v>cap) v=cap; t[a.extend]=Math.max(t[a.extend],v); } return; }
    if(a.dotRate!=null){ const k=(ctx.dt||0)*amtOf(T,u,a.dotRate,ctx); if(!(k>0)) return;          // her DoTs on those units tick that much faster (on a tick row: each tick comes sooner, the same number of ticks)
      for(const t of pick(T,u,a.on,ctx)){ const D=t.dots; if(D) for(let i=0;i<D.length;i++) if(myDot(u,D[i],true)) D[i].acc+=k; } return; }
    if(a.extendDot!=null){ const d=ctx.dot; if(!d||!(d.remaining>0)) return; const add=amtOf(T,u,a.extendDot,ctx)/(d.interval||1); if(!(add>0)) return;   // the DoT the event is about lasts that many seconds longer (a part tick at the end)
      const n=d.remaining-1+(d._talF!=null?d._talF:1)+add; d.remaining=Math.ceil(n-1e-9); const f=n-(d.remaining-1); d._talF=(f<1-1e-9)?f:null; return; }
    if(a.field){ for(const t of pick(T,u,a.on||'self',ctx)){ let v=a.set!=null?amtOf(T,u,a.set,ctx):(+t[a.field]||0); if(a.add!=null) v+=amtOf(T,u,a.add,ctx);   // an engine counter on a unit (Crescendo's ring count, Aldren's Living Pages)
        if(a.min!=null) v=Math.max(amtOf(T,u,a.min,ctx),v); if(a.max!=null) v=Math.min(amtOf(T,u,a.max,ctx),v); t[a.field]=v; } return; }   // set: from that amount; min / max: at least / at most
    if(a.unitStat){ const S=a.unitStat; for(const t of pick(T,u,a.on||'unit',ctx)){ if(!t.alive) continue;   // a unit's own numbers made that much larger, once (a summon as it is called)
        if(S.hp){ const k=Math.max(0.05,1+S.hp); t.maxHp*=k; t.hp*=k; } if(S.atk) t.dmg=(t.dmg||0)*Math.max(0,1+S.atk); if(S.apow) t.apow=(t.apow||0)*Math.max(0,1+S.apow); if(S.move) t.speed=(t.speed||0)*Math.max(0,1+S.move); } return; }
    if(a.place){ const n=pick(T,u,a.near,ctx)[0]; if(!n||n.x==null) return; for(const t of pick(T,u,a.place,ctx)){ if(!t.alive||t===n) continue;   // a unit set down beside another (next to the enemy it hunts)
        const dx=t.x-n.x, dy=t.y-n.y, L=Math.hypot(dx,dy), g=(n.pt?0:E.bodyR(n))+E.bodyR(t)+0.2*E.METER(), ux=L>1?dx/L:(t.team===u.team?-1:1), uy=L>1?dy/L:0;
        t.x=n.x+ux*g; t.y=n.y+uy*g; t._ax=t.x; t._ay=t.y; if(!n.pt&&n.team!==t.team&&n.alive) t.target=n; } return; }
    if(a.buff){ const k=a.buff, x=amtOf(T,u,a.x,ctx), d=amtOf(T,u,a.dur,ctx); if(!(d>0)) return; for(const t of pick(T,u,a.on||'self',ctx)) if(t.alive) buffOn(t,k,x,d); return; }   // one of the engine's own timed buffs (see buffOn)
    if(a.castSkill){ if(!E.castSlot) return; for(const t of pick(T,u,a.on,ctx)) if(t.alive&&u.alive) E.castSlot(u,a.castSkill,t); return; }   // the hero casts one of his own skills at that unit (no cooldown spent, no press: The Last Chapter)
    if(a.kill){ for(const t of pick(T,u,a.on,ctx)) if(t.alive) hurt(T,u,t,((t.hp||0)+(t.shield||0))*20+1,a.color,a.tag); return; }   // a talent kill: through the engine's own damage (a unit kept alive by a save stays alive)
    if(a.strip!=null){ for(const t of pick(T,u,a.on,ctx)) if((t.shield||0)>0) t.shield*=Math.max(0,1-a.strip); return; }   // that share of a unit's shield is gone
    if(a.call){ const f=E.fx&&E.fx[a.call]; if(!f) return; const n=a.n==null?1:Math.floor(amtOf(T,u,a.n,ctx)+1e-9);                 // one of the engine's own effects, by name (bind: fx)
      for(const t of pick(T,u,a.on,ctx)){ for(let i=0;i<n&&t.alive;i++){ if(f(t,u)===false) break; if(a.emit&&T.on[a.emit]) run(T,u,a.emit,Object.assign({},ctx,{tgt:t,proc:true})); } } return; }   // the effect may refuse (false); emit: once per application
    if(a.stun!=null||a.silence!=null){ const f=a.stun!=null?'stunned':'silencedT', secs=amtOf(T,u,a.stun!=null?a.stun:a.silence,ctx); if(!(secs>0)) return;
      for(const t of pick(T,u,a.on,ctx)) if(t.alive) control(T,u,t,f,secs,a.asIs); return; }                                           // the stated seconds, written straight on (no resist roll, no seeded draw)
    if(a.endCc){ for(const t of pick(T,u,a.on,ctx)) if(t.alive) t[a.endCc]=0; return; }                                   // a control on that unit ends now (a shattered freeze)
    if(a.timer){ const x=amtOf(T,u,a.min,ctx); for(const t of pick(T,u,a.on,ctx)) if(t.alive&&!((t[a.timer]||0)>=x)) t[a.timer]=x; return; }   // an engine timer on a unit is raised to at least that ('_chillT': Chill lasts longer)
    if(a.atOne){ for(const t of pick(T,u,a.atOne,ctx)) if(t.hp<1) t.hp=1; ctx.stop=true; return; }                                 // on a teamLethal row: that unit does not die from this blow
    if(a.window){ const w=s.w[a.window]||(s.w[a.window]={t:0,n:0,cdT:0,at:-1,wave:false});
      if(a.end){ w.t=0; return; }
      if(a.add!=null){ if(w.t>0&&w.at!==E.now()) w.t+=a.add; return; }
      if(a.cd&&E.now()<w.cdT) return false;
      const n=a.count!=null?cnt(T,u,a.count,ctx):(a.n==null?1:a.n); if(a.min!=null&&n<a.min) return false;
      const d=a.dur==='wave'?Infinity:amtOf(T,u,a.dur,ctx);
      w.n=(a.most&&w.t>0)?Math.max(w.n,n):n; w.t=(a.longest&&w.t>d)?w.t:d; w.wave=a.dur==='wave'; w.at=E.now(); if(a.cd) w.cdT=E.now()+a.cd; return; }   // longest: never shortens a window that has longer to run
    if(a.dot){ const ts=pick(T,u,a.on,ctx), every=a.every||1, dur=amtOf(T,u,a.dur,ctx), ticks=Math.max(1,Math.ceil(dur/every-1e-9)), frac=dur/every-(ticks-1);
      let per=amtOf(T,u,a.amt,ctx); if(a.total) per=per/(dur/every); if(!(per>0)) return;
      for(const t of ts){ if(a.refresh){ let f=null; for(const d of t.dots) if(myDot(u,d,a.dot)){ f=d; break; } if(f){ f.dps=per; f.remaining=ticks; f._talF=(frac<1-1e-9)?frac:null; continue; } }
        E.pushDot(t,per,ticks*every,every,a.color||'#8f8fa8',u,a.kind||'true'); const d=t.dots[t.dots.length-1]; d._talO=u.uid; d._talK=a.dot; if(frac<1-1e-9) d._talF=frac;
        if(a.emitDot&&T.on[a.emitDot]) run(T,u,a.emitDot,Object.assign({},ctx,{tgt:t,dot:d})); }   // emitDot: an event about the DoT just applied
      return; }
    if(a.jumpDots){ const from=pick(T,u,a.from||'unit',ctx)[0]; if(!from||!from.dots) return; const to=pick(T,u,a.to,ctx)[0]; if(!to) return;
      for(const d of from.dots.slice()){ if(!myDot(u,d,a.jumpDots)) continue; const left=d.remaining-(d._talNow?1:0); if(left<1) continue;
        E.pushDot(to,d.dps,left*d.interval,d.interval,d.color,u,d.kind||'true'); const nd=to.dots[to.dots.length-1]; nd._talO=u.uid; nd._talK=d._talK; if(d._talF!=null) nd._talF=d._talF; d.remaining=d._talNow?1:0; }
      return; }
    if(a.heal!=null||a.hot!=null){ const A=a.heal!=null?a.heal:a.hot, pw=a.pow?(u.healPowMul||1):1;   // pow: the hero's healing power applies, as to the heals of his skills
      for(const t of pick(T,u,a.on||'self',ctx)){ if(!t.alive) continue; const c2=Object.assign({},ctx,{tgt:t}); c2.amt=amtOf(T,u,A,c2)*pw;
        if(a.tag&&T.on['heal:'+a.tag]) run(T,u,'heal:'+a.tag,c2);                                   // rows may change this heal ("... heals 5% more on allies below half")
        if(!(c2.amt>0)) continue;
        if(a.hot!=null){ const every=a.every||1, dur=amtOf(T,u,a.dur,ctx)||3; E.pushHot(t,a.perTick?c2.amt:c2.amt/Math.max(1,Math.round(dur/every)),dur,every);   // perTick: the amount is each tick's heal
          if(a.htag){ const h=t.hots[t.hots.length-1]; if(h){ h._talX=u.uid; h._talK=a.htag; } } } else E.healUnit(t,c2.amt);   // htag: her talent's heal over time, so a row can stop it (unhot)
        if(a.emit&&T.on[a.emit]) run(T,u,a.emit,c2); } return; }
    if(a.shield!=null){ const d=amtOf(T,u,a.dur,ctx)||4, pw=a.pow?(u.shieldStrMul||1):1;
      for(const t of pick(T,u,a.on||'self',ctx)){ const c2=Object.assign({},ctx,{tgt:t}), x=amtOf(T,u,a.shield,c2)*pw; if(!(x>0)) continue;
        t.shield=a.mode==='max'?Math.max(t.shield||0,x):(t.shield||0)+x; t.shieldT=Math.max(t.shieldT||0,d); if(a.emit&&T.on[a.emit]){ c2.amt=x; run(T,u,a.emit,c2); } } return; }   // mode max: as the engine's own skill shields (the larger one stays)
    if(a.unshield){ u.shield=0; return; }
    if(a.energy!=null){ for(const t of pick(T,u,a.on||'self',ctx)) t.energy=Math.max(0,Math.min(100,(t.energy||0)+a.energy)); return; }
    if(a.dmg!=null){ const sc=a.scale==null?1:a.scale; let done=0, asked=0;
      for(const t of pick(T,u,a.on,ctx)){ const x=amtOf(T,u,a.dmg,Object.assign({},ctx,{tgt:t}))*sc; if(!(x>0)) continue; let y=x;   // the amount is read for each unit struck ("6% of its max HP")
        if(a.tag&&T.on['dmg:'+a.tag]){ const c2=Object.assign({},ctx,{tgt:t,amt:x}); run(T,u,'dmg:'+a.tag,c2); y=c2.amt; }   // rows may change this damage
        if(a.def) y*=E.defMul(u,t,a.def);                                                                    // def: the target's resist applies, as to her skill's own hit (a skill burst repeated by a talent)
        asked+=y; done+=hurt(T,u,t,y,a.color,a.tag); }
      if(a.emit&&done>0) run(T,u,a.emit,Object.assign({},ctx,{spent:done}));
      if(a.emitAmt&&T.on[a.emitAmt]) run(T,u,a.emitAmt,Object.assign({},ctx,{spent:done,amt:asked})); return; }   // emitAmt: an event in any case, amt = the damage as dealt (before the target's shield)
    if(a.cd){ const f=a.cd==='blue'?'blueCd':'greenCd'; if(a.set!=null) u[f]=a.set; else if(a.mul!=null) u[f]=Math.max(0,(u[f]||0)*a.mul); else u[f]=Math.max(0,(u[f]||0)+a.add); return; }   // mul: the time left that many times
    if(a.slow!=null){ let d=a.dur||1; if(T.on.ccOut){ const c={u,src:u,field:'slow',amt:d}; run(T,u,'ccOut',c); d=c.amt; }
      for(const t of pick(T,u,a.on,ctx)){ t.slow=Math.max(t.slow||0,d); t.slowMul=Math.min(t.slowMul==null?1:t.slowMul,Math.max(0.05,1-a.slow)); } return; }
    if(a.slowMore!=null){ const m=E.slowMul(u); for(const t of pick(T,u,a.on,ctx)) if((t.slow||0)>0) t.slowMul=Math.min(t.slowMul==null?1:t.slowMul,Math.max(0.05,1-(1-m)*(1+a.slowMore))); return; }   // the slow his skill just applied, that much stronger
    if(a.taunt!=null){ for(const t of pick(T,u,a.on,ctx)){ t.forcedTarget=u; t.forcedTargetT=Math.max(t.forcedTargetT||0,a.taunt); } return; }
    if(a.cleanse){ for(const t of pick(T,u,a.on||'self',ctx)) for(const f of CLEANSE) if((t[f]||0)>0){ t[f]=0; break; } return; }
    if(a.undying!=null){ s.undy=Math.max(s.undy,a.undying); if(u.hp<1) u.hp=1; ctx.stop=true; return; }
    if(a.roll){ const q=s.roll[a.roll]||(s.roll[a.roll]={span:a.span||3,e:[]}); q.span=a.span||3; const now=E.now(); q.e.push([now,amtOf(T,u,a.add,ctx)]); while(q.e.length&&q.e[0][0]<=now-q.span) q.e.shift(); return; }
    if(a.emit){ if(a.amt!=null){ run(T,u,a.emit,Object.assign({},ctx,{amt:amtOf(T,u,a.amt,ctx)})); return; }   // amt: the event carries that number (its rows may change it)
      if(a.on==null&&a.k==null){ run(T,u,a.emit,ctx); return; }                           // on:<who>: once for each such unit (it becomes the event's target); k: a size the event's amounts read
      for(const t of (a.on==null?[ctx.tgt]:pick(T,u,a.on,ctx))) run(T,u,a.emit,Object.assign({},ctx,{tgt:t,k:a.k==null?ctx.k:a.k})); return; }
    if(a.fn){ return T.fn[a.fn](API,T,u,ctx,a); } }

  /* ---- stats that change during the fight (rows {stat:{...}, per, if}): the difference is applied to the unit's own number, so whatever
          else the engine does to that number is kept. atk, armor, mr, move: "x more" (multiply); aspd: attack speed; crit, lifesteal: added;
          immovable: a flag. Recomputed once a tick; a number is touched only when its total changed. ---- */
  const S_MUL={atk:'dmg',armor:'armorRating',mr:'mrRating',move:'speed',apow:'apow',heal:'healPowMul'}, S_ADD={crit:'glyphCrit',lifesteal:'lifestealStat',dodge:'_talDodge'};   // dodge: her talent dodge chance (read by the dodge rows' chance)
  function restat(T,u){ if(!T.stats.length) return; const tot={}, ctx={u,tgt:u.target};
    for(let i=0;i<T.stats.length;i++){ const row=T.stats[i]; if(row.if&&!ok(T,u,row.if,ctx)) continue; const n=row.per!=null?cnt(T,u,row.per,ctx):1; if(!n) continue; for(const k in row.stat) tot[k]=(tot[k]||0)+row.stat[k]*n; }
    setStats(u,tot,T.s.ap,T.s.z);
    if(T.nrg){ const e=u.energy||0, p=T.s.e0; if(p!=null&&e>p&&tot.nrg>0) u.energy=Math.min(100,e+(e-p)*tot.nrg); T.s.e0=u.energy||0; } }   // nrg: ultimate energy she gained since the last tick, that share more (from any source)
  function setStats(u,tot,ap,z){
    { const nw=Math.max(0.05,1+(tot.hp||0)), old=ap.hp==null?1:ap.hp; if(nw!==old){ const k=nw/old; u.maxHp*=k; u.hp*=k; ap.hp=nw; } }     // max HP: the HP he has keeps its share
    ap.cdRate=tot.cdRate||0;                                                                                                                // cooldowns recover that much faster (negative: slower); see auras()
    for(const k in S_MUL){ const nw=Math.max(0,1+(tot[k]||0)), old=ap[k]==null?1:ap[k]; if(nw===old) continue; const f=S_MUL[k];
      if(old===0) u[f]=(z[k]||0)*nw; else if(nw===0){ z[k]=(u[f]||0)/old; u[f]=0; } else u[f]=(u[f]||0)/old*nw; ap[k]=nw; }
    { const nw=Math.max(0.05,1+(tot.aspd||0)), old=ap.aspd==null?1:ap.aspd; if(nw!==old){ u.atkInterval=u.atkInterval*old/nw; ap.aspd=nw; } }
    for(const k in S_ADD){ const f=S_ADD[k], old=ap[k]||0; let nw=tot[k]||0; if(k==='crit') nw=Math.min(nw,Math.max(0,0.6-((u[f]||0)-old))); if(nw!==old){ u[f]=(u[f]||0)-old+nw; ap[k]=nw; } }
    { const nw=!!tot.immovable; if(nw!==!!ap.imm){ if(nw){ ap.immWas=u.immovable; u.immovable=true; } else u.immovable=ap.immWas; ap.imm=nw; } } }
  /* stat rows that sit on OTHER units ({stat, to:<who>, per, if}: an aura, a debuff on marked enemies). Each tick: who is picked now, what they get; a unit
     no longer picked gets its numbers back. T.s.au = [{x: the unit, ap, z, g0, b0}], in the order units were first touched. Taken off when the owner dies. */
  function auras(T,u,dt){ const au=T.s.au; if(!T.auras.length&&!au.length) return; const ctx={u,tgt:u.target};
    for(let i=0;i<au.length;i++) au[i].tot=null;
    for(let i=0;i<T.auras.length;i++){ const row=T.auras[i]; if(row.if&&!ok(T,u,row.if,ctx)) continue; const us=pick(T,u,row.to,ctx);
      for(let j=0;j<us.length;j++){ const x=us[j]; let e=null; for(let q=0;q<au.length;q++) if(au[q].x===x){ e=au[q]; break; }
        if(!e){ e={x,ap:{},z:{},tot:null,g0:null,b0:null}; au.push(e); } const c2={u,tgt:x}, n=row.per!=null?cnt(T,u,row.per,c2):1; if(!n) continue;
        const tot=e.tot||(e.tot={}); for(const k in row.stat) tot[k]=(tot[k]||0)+row.stat[k]*n; } }
    for(let i=0;i<au.length;i++){ const e=au[i], x=e.x; if(!x.alive){ au.splice(i--,1); continue; } if(!sameTot(e.tot,e.lt)||(e.tot&&'crit' in e.tot)) setStats(x,e.tot||{},e.ap,e.z); e.lt=e.tot;   // the same totals as last tick: nothing to change (crit: its cap reads the unit's own crit, so always)
      if(e.ap.cdRate){ for(const f of CDF){ const k=f==='greenCd'?'g0':'b0', was=e[k], cur=x[f]; if(was!=null&&cur>0&&was>cur&&was-cur<=dt*4) x[f]=cur-(was-cur)*e.ap.cdRate; e[k]=x[f]; } }   // what the cooldown recovered this tick, that share given back / taken
      else{ e.g0=null; e.b0=null; if(!e.tot){ au.splice(i--,1); } } } }
  const CDF=['greenCd','blueCd'];
  function sameTot(a,b){ if(a===b) return true; if(!a||!b) return false; for(const k in a) if(a[k]!==b[k]) return false; for(const k in b) if(!(k in a)) return false; return true; }
  function unaura(T){ const au=T.s.au; for(let i=0;i<au.length;i++) if(au[i].x.alive) setStats(au[i].x,{},au[i].ap,au[i].z); au.length=0; }

  /* =========================== THE HOOKS (called by the page; every call site is guarded on u._tal) =========================== */
  /* outgoing damage: in _dealDamageCore once the hit has landed and its crit is known, just before the HP is removed */
  function out(src,tgt,amt,kind,auto,crit){ const T=src._tal, ctx={u:src,src,tgt,amt,kind,auto:!!auto,crit:!!crit,proc:T.s.d>0}; run(T,src,'out',ctx); return ctx.amt; }
  /* incoming damage: the same place. The target's own rows ('in'), then the rows of talented units watching it ('teamIn': team-wide effects) */
  function inc(tgt,src,amt,kind,auto,crit){ const T=tgt._tal; if(tgt._talW&&src&&src.team!==tgt.team) tgt._talBy=src;   // a watched unit remembers the enemy that last hit it
    if(T&&T.on.in&&src&&src.team!==tgt.team){ const ctx={u:tgt,src,tgt,amt,kind,auto:!!auto,crit:!!crit}; run(T,tgt,'in',ctx); amt=ctx.amt; }
    const W=tgt._talW; if(W) for(let i=0;i<W.length;i++){ const o=W[i], To=o._tal; if(o===tgt||!o.alive||!To||!To.on.teamIn) continue;
      const ctx={u:o,src,tgt,amt,kind,auto:!!auto,crit:!!crit}; run(To,o,'teamIn',ctx); amt=ctx.amt; }
    return amt; }
  /* crit: just before the engine decides the hit's crit. A row may force it (returns true); otherwise the engine's own value / roll stands */
  function crit(src,tgt,pre,kind,auto){ const T=src._tal, ctx={u:src,src,tgt,kind,auto:!!auto,proc:T.s.d>0,force:false}; run(T,src,'crit',ctx); return ctx.force?true:pre; }
  /* after a hit landed: 'hit' for the attacker (then 'kill' if it killed), 'hurt' for the one struck */
  function hit(src,tgt,hpLost,amt,kind,auto,crit,hpBefore){
    if(src&&src._tal){ const T=src._tal, ctx={u:src,src,tgt,amt,hpLost,kind,auto:!!auto,crit:!!crit,proc:T.s.d>0};
      if(T.on.hit) run(T,src,'hit',ctx);
      if(T.on.kill&&hpBefore>0&&!tgt.alive){ ctx.overkill=Math.max(0,-tgt.hp); run(T,src,'kill',ctx); } }
    if(tgt._tal&&tgt._tal.on.hurt&&src&&src.team!==tgt.team&&tgt.alive){ const T=tgt._tal; run(T,tgt,'hurt',{u:tgt,src,tgt,amt,hpLost,kind,auto:!!auto,crit:!!crit}); } }
  /* a hit is about to kill: a row may keep the unit alive (action `undying`); while that holds, it cannot drop below 1 HP */
  function lethal(u){ const T=u._tal; if(T.s.undy>0){ u.hp=1; return; } run(T,u,'lethal',{u,tgt:u}); if(T.s.undy>0&&u.hp<1) u.hp=1; }
  /* a unit died: its own 'die' rows, then 'death' for every talented unit watching it */
  function death(u){ const T=u._tal; if(T&&T.on.die) run(T,u,'die',{u,unit:u,tgt:u}); if(T&&T.s.au.length) unaura(T);
    const W=u._talW; if(W) for(let i=0;i<W.length;i++){ const o=W[i]; if(o===u||!o.alive||!o._tal||!o._tal.on.death) continue; run(o._tal,o,'death',{u:o,unit:u,tgt:u}); } }
  /* healing received, before the engine cuts it to the room left: over = what will not fit */
  function heal(u,a){ const T=u._tal; run(T,u,'heal',{u,tgt:u,amt:a,over:Math.max(0,a-Math.max(0,E.healCap(u)-u.hp)),proc:T.s.d>0}); }
  /* skill options, before the skill resolves (returns a changed copy) and after it resolved */
  const skTgt=(u,o)=>(o&&o._arrived&&o._tgtU)||u.target;                 // a skill that travels to its target lands on the unit it was thrown at
  function kit(u,type,o){ const T=u._tal, ctx={u,tgt:skTgt(u,o),skill:type,o:Object.assign({},o)}; T.s.cur=type; run(T,u,'kit',ctx); return ctx.o; }
  function cast(u,type,o){ const T=u._tal; T.s.cur=null; const q=T.s.later; if(q.length){ T.s.later=[]; for(let i=0;i<q.length;i++) acts(T,u,q[i][0],q[i][1]); }   // what rows put off until the skill had finished
    run(T,u,'cast',{u,tgt:skTgt(u,o),skill:type,o:o||{}}); }
  /* HER HEALS. healOut: a heal of a skill of hers (the page's healFrom, src = her): 'healOut' rows change it (before her healing power, as healFrom applies it),
     the engine heals through its own healFrom, then 'healed' rows see it land: amt = HP it restored, heal = what was offered (after healing power),
     over = what did not fit (0 unless it filled the room left), raw = the skill's own number, skill = the skill being cast. Never lets an error out, and
     always heals exactly once. hotPre / hotPost: the same for each tick of a heal over time her rows made hers (tagHots), then 'hotEnd' on its last tick. */
  function healOut(s,t,a){ const T=s._tal; let ctx=null;
    try{ ctx={u:s,src:s,tgt:t,unit:t,amt:a,raw:a,skill:T.s.cur,hot:false}; if(T.s.cur) T.s.lh=a; run(T,s,'healOut',ctx); a=Math.max(0,ctx.amt); }catch(e){ ERR.n++; ERR.last=String((e&&e.stack)||e).slice(0,600); ctx=null; }
    const hp0=t.hp, room=Math.max(0,E.healCap(t)-hp0); T.hb=1; try{ E.healFrom(s,t,a); } finally{ T.hb=0; }
    if(ctx) try{ ctx.heal=a*(s.healPowMul||1); landed(T,s,t,ctx,hp0,room); }catch(e){ ERR.n++; ERR.last=String((e&&e.stack)||e).slice(0,600); } }
  function landed(T,o,t,c,hp0,room){ const got=Math.max(0,t.hp-hp0); c.amt=got; c.over=(got>=room-1e-9)?Math.max(0,c.heal-room):0; if(T.on.healed) run(T,o,'healed',c); }
  function hotPre(t,h){ const o=h._talU, T=o&&o._tal; if(!T||!o.alive) return null;
    const ctx={u:o,src:o,tgt:t,unit:t,amt:h.hps,raw:h.hps,skill:h._talK,hot:true}; run(T,o,'healOut',ctx);
    const keep=h.hps; h.hps=Math.max(0,ctx.amt); return {keep,ctx,hp0:t.hp,room:Math.max(0,E.healCap(t)-t.hp)}; }
  function hotPost(t,h,k){ const o=h._talU, T=o._tal, c=k.ctx; c.heal=h.hps; h.hps=k.keep; landed(T,o,t,c,k.hp0,k.room);
    if(h.remaining<=1&&T.on.hotEnd) run(T,o,'hotEnd',{u:o,tgt:t,unit:t,amt:k.keep,tag:h._talK}); }
  /* a number the engine keeps inside a skill's own code (a channel's radius, a proc chance): rows {on:'num',skill:'<name>', add / addM / more / mul} */
  function num(u,name,v){ const ctx={u,skill:name,amt:v,tgt:u.target}; run(u._tal,u,'num',ctx); return ctx.amt; }
  /* a control effect LANDED (after the resist roll): 'ccHit' for the one who applied it. direct: the engine wrote this
     control without ccApply (a channel's proc) - the owner's ccOut rows get their say now, and the longer time is written on. */
  function ccHit(by,t,field,dur,direct){ const T=by&&by._tal;
    if(direct&&T&&T.on.ccOut){ const c={u:by,src:by,tgt:t,field,amt:dur}; run(T,by,'ccOut',c); let d=c.amt; const cap=E.ccCap(field); if(cap&&d>cap) d=cap; if(d>dur){ t[field]=Math.max(t[field]||0,d); dur=d; } }
    if(T&&T.on.ccHit) run(T,by,'ccHit',{u:by,src:by,tgt:t,field,amt:dur}); }
  /* healing about to land on u: 'teamHeal' for the talented units watching it (an enemy's healing cut, an ally's raised) */
  function healIn(u,a){ const W=u._talW; if(W) for(let i=0;i<W.length;i++){ const o=W[i], To=o._tal; if(o===u||!o.alive||!To||!To.on.teamHeal) continue; const c={u:o,tgt:u,unit:u,amt:a,a0:a}; run(To,o,'teamHeal',c); a=c.amt; }
    return Math.max(0,a); }
  /* a Chill the hero's own skill just put on t (Sylthaine's Cold Snap): 'chill' rows. Only when her passive is unlocked - without it the skill applies no Chill */
  function chill(u,t){ if(!(u.pass&&u.pass.coldsnap)||!t) return; run(u._tal,u,'chill',{u,src:u,tgt:t}); }
  /* u is about to die from a blow (its own talents and Dawnward did not hold it): 'teamLethal' rows of the talented units watching it may keep it at 1 HP */
  function teamLethal(u){ const W=u._talW; if(!W) return; for(let i=0;i<W.length&&u.hp<=0;i++){ const o=W[i], To=o._tal; if(o===u||!o.alive||!To||!To.on.teamLethal) continue; run(To,o,'teamLethal',{u:o,unit:u,tgt:u}); } }
  /* a control effect landed on a watched unit through the engine's ccApply (after the resist roll; anyone's: an ally's stun on an enemy): 'teamCc' rows of the
     talented units watching it (ctx.unit = the unit, src = who applied it, field, amt = seconds as written). Absalie's Shared Fall */
  function teamCc(t,by,field,dur){ const W=t._talW; if(!W) return; for(let i=0;i<W.length;i++){ const o=W[i], To=o._tal; if(o===t||!o.alive||!To||!To.on.teamCc) continue;
      run(To,o,'teamCc',{u:o,src:by,tgt:t,unit:t,field,amt:dur}); } }
  /* energy a watched unit gains from being hit (damage(): nrgPre right before the engine adds it, nrgIn right after): 'teamNrg' rows of the talented units
     watching it may cut that gain (ctx.amt = what it gained; less / mul). Returns the unit's energy. Absalie's Closed Door */
  function nrgPre(u){ u._talE0=u.energy||0; }
  function nrgIn(u){ const e0=u._talE0, e1=u.energy||0; u._talE0=null; if(e0==null||!(e1>e0)) return e1; const W=u._talW; let g=e1-e0;
    if(W) for(let i=0;i<W.length;i++){ const o=W[i], To=o._tal; if(o===u||!o.alive||!To||!To.on.teamNrg) continue; const c={u:o,tgt:u,unit:u,amt:g}; run(To,o,'teamNrg',c); g=Math.max(0,Math.min(g,c.amt)); }
    return e0+g; }
  /* an enemy's hit is coming at her (before any miss): 'aimed' rows ("an enemy that attacks Vex, hit or miss"); then, unless the hit cannot miss (true damage, a
     can't-miss gear effect), her 'dodge' rows may dodge it (action {dodge:true}, normally behind a seeded chance): true = dodged, the page leaves the hit, and 'dodged' rows run */
  function dodge(t,s,auto,kind,sure){ const T=t._tal, ctx={u:t,src:s,tgt:t,unit:t,auto:!!auto,kind};
    if(T.on.aimed) run(T,t,'aimed',ctx);
    if(kind==='true'||sure||!T.on.dodge) return false;
    ctx.dodged=false; run(T,t,'dodge',ctx); if(!ctx.dodged) return false;
    if(T.on.dodged) run(T,t,'dodged',Object.assign({},ctx,{dodged:true})); return true; }
  /* after the 'in' rows: a row said this hit misses her ({miss:true}) - the page leaves the hit before any damage */
  function miss(t){ const m=!!t._talMiss; t._talMiss=0; return m; }
  /* her passive just acted on t at a swing (Vex's Killer Instinct): passPre right before (what the engine timer was), pass right after: 'pass' rows (ctx.was) */
  function passPre(u,t){ u._tal.s.pw=(t&&t.mortalT)||0; }
  function pass(u,t,name){ const T=u._tal; run(T,u,'pass',{u,src:u,tgt:t,skill:name,was:T.s.pw||0}); }
  /* a skill has picked its target (Hookline's mark): 'skillTgt' rows may send it to another unit ({retarget:<who>}); then 'skillAt' rows see the final target, the skill's
     options (ctx.o, the very object the skill reads its numbers from next) and the caster where she stands. Returns the target (null: the skill does not fire) */
  function skillTgt(u,skill,mark,o){ const T=u._tal, ctx={u,src:u,tgt:mark||null,skill,o:o||{}};
    if(T.on.skillTgt) run(T,u,'skillTgt',ctx); if(ctx.tgt&&T.on.skillAt) run(T,u,'skillAt',ctx); return ctx.tgt||null; }
  /* a skill that travels lands (Hookline: she lands behind its mark). landPre: right before its strike - while it resolves the strike is that skill's ('casting');
     land: right after - 'land' rows ("the moment she lands behind someone") */
  function landPre(u,t,skill){ const T=u._tal; T.s.cur=skill; if(T.on.landPre) run(T,u,'landPre',{u,src:u,tgt:t,skill}); }
  function land(u,t,skill){ const T=u._tal; T.s.cur=null; if(T.on.land) run(T,u,'land',{u,src:u,tgt:t,skill}); }
  /* an area skill of hers is about to strike: where (c, the centre the skill itself uses), its options (o) and its damage to each enemy before the
     target's resist (raw). Kept as T.s.pt[skill] (a point: rows read 'pt:<skill>'), then 'at' rows (ctx.pt, ctx.o, ctx.raw). Astra's Starfire, Nebula, Collapsing Star */
  function at(u,skill,c,o,raw){ const T=u._tal; if(!c) return; const p={x:c.x,y:c.y,pt:true}; T.s.pt[skill]=p; if(T.on.at) run(T,u,'at',{u,src:u,tgt:u.target,skill,o:o||{},pt:p,raw:raw||0}); }
  /* ---- HIS SUMMONS (Aldren). summon: summonUnit has just made a summon of his (its stats set, before it joins the field): it carries him as x._talS (never on a
     snap: summons are not snapped), and 'summon' rows run (ctx.unit = ctx.tgt = the summon, key, extra = called by his talents, not by his skill).
     Its hits run his 'sOut' rows (change the hit) and 'sHit' / 'sKill' rows (after it landed; ctx.src = ctx.unit = the summon); its lifetime running out while
     it stands runs 'sGone' (ctx.unit = it, ctx.tgt = the enemy it was hunting); a control on it runs 'sCcIn' (seconds in, seconds out). Hits ON it and its
     death are seen through his watch, as for any unit ('teamIn', 'death', 'teamLethal' with unitMine / targetMine). ---- */
  function summon(o,x,key){ const T=o._tal; x._talS=o; if(T.s.ex) x._talEx=1; mineOf(T,o).push(x);
    if(T.on.summon) run(T,o,'summon',{u:o,src:o,tgt:x,unit:x,key,extra:!!T.s.ex}); }
  function sOut(x,t,amt,kind,auto,crit){ const o=x._talS, T=o&&o._tal; if(!T||!o.alive||!T.on.sOut) return amt;
    const ctx={u:o,src:x,tgt:t,unit:x,amt,kind,auto:!!auto,crit:!!crit}; run(T,o,'sOut',ctx); return ctx.amt; }
  function sHit(x,t,hpLost,amt,kind,auto,crit,hpBefore){ const o=x._talS, T=o&&o._tal; if(!T||!o.alive) return; const ctx={u:o,src:x,tgt:t,unit:x,amt,hpLost,kind,auto:!!auto,crit:!!crit};
    if(t&&t.team!==x.team) x._talHunt=t;                                                                       // the enemy it last struck (what it was hunting, if its target is gone)
    if(T.on.sHit) run(T,o,'sHit',ctx); if(T.on.sKill&&hpBefore>0&&!t.alive){ ctx.overkill=Math.max(0,-t.hp); run(T,o,'sKill',ctx); } }
  function sGone(x){ const o=x._talS, T=o&&o._tal; if(!T||!o.alive||!T.on.sGone) return; const ok=h=>!!(h&&h.alive&&h.team!==x.team), h=ok(x._talHunt)?x._talHunt:ok(x.target)?x.target:null;   // the enemy it last struck, else the one it was going for
    run(T,o,'sGone',{u:o,src:o,unit:x,tgt:h}); }
  function sCc(by,t,field,dur){ const o=t._talS, T=o&&o._tal; if(!T||!o.alive||!T.on.sCcIn) return dur; const c={u:o,src:by,tgt:t,unit:t,field,amt:dur}; run(T,o,'sCcIn',c); return Math.max(0,c.amt); }
  /* ---- HIS LIVING PAGES (Aldren's passive: a spell writes a page at its press, castKit; the next swing spends one for a magic hit). pagePre: right before the swing's
     page block ('pagePre' rows may give or take pages first; ctx.was = pages held); while the page hit resolves, 'casting' is 'page'; page: right after it ('page' rows).
     pageW0 / pageW: around the write at the press ('pageW' rows, ctx.was = the pages before the write, skill = the spell pressed) ---- */
  function pagePre(u,t){ const T=u._tal, s=T.s; s.pgC=s.cur; s.pgOn=false; if(T.on.pagePre.length) run(T,u,'pagePre',{u,src:u,tgt:t,was:u._pages||0});
    if((u._pages||0)>0){ s.cur='page'; s.pgOn=true; } }
  function page(u,t){ const T=u._tal, s=T.s; if(!s.pgOn) return; s.pgOn=false; s.cur=s.pgC==null?null:s.pgC; s.pgC=null; if(T.on.page.length) run(T,u,'page',{u,src:u,tgt:t}); }
  function pageW0(u){ u._tal.s.pw0=u._pages||0; }
  function pageW(u,ab){ const T=u._tal; run(T,u,'pageW',{u,src:u,tgt:u.target,was:T.s.pw0||0,skill:ab&&ab.type}); }
  /* a cooldown was just set after a cast: slot 'green' | 'blue' */
  function cd(u,slot,v){ const ctx={u,slot,skill:slot,amt:v}; run(u._tal,u,'cd',ctx); return Math.max(0,ctx.amt); }
  /* a control effect is being applied by `by` to `t`: seconds in, seconds out */
  function cc(by,t,field,dur,tal){ if(t._tal&&t._tal.on.ccIn){ const c={u:t,src:by,tgt:t,field,amt:dur,talent:!!tal}; run(t._tal,t,'ccIn',c); dur=c.amt; }
    if(by&&by._tal&&by._tal.on.ccOut){ const c={u:by,src:by,tgt:t,field,amt:dur,talent:!!tal}; run(by._tal,by,'ccOut',c); dur=c.amt; } return dur; }
  /* a DoT tick: before it (the target's 'dotIn' rows, and a talent DoT's shorter last tick), and after it (the owner's 'dotTick', a kill by the DoT) */
  function dotPre(u,d){ const keep=[d.dps,u.hp,u.shield||0]; let x=d.dps; const T=u._tal;
    if(T&&T.on.dotIn){ const ctx={u,src:d.src,tgt:u,amt:x,dot:d}; run(T,u,'dotIn',ctx); x=ctx.amt; }
    const o=d.src, To=o&&o._tal; if(To&&To.on.dotOut&&d._talO===o.uid&&o.alive){ const c={u:o,src:o,tgt:u,amt:x,dot:d,tag:d._talK}; run(To,o,'dotOut',c); x=c.amt; }   // the owner's rows change her own DoT's tick
    if(d._talF!=null&&d.remaining<=1) x*=d._talF; d.dps=x; d._talNow=true; return keep; }
  function dotPost(u,d,keep){ d.dps=keep[0]; d._talNow=false; const o=d.src, T=o&&o._tal; if(!T||d._talO!==o.uid) return;
    if(T.on.dotTick&&o.alive) run(T,o,'dotTick',{u:o,src:o,tgt:u,dot:d,tag:d._talK,amt:Math.max(0,((keep[1]||0)-Math.max(0,u.hp))+((keep[2]||0)-(u.shield||0)))});   // amt: what the tick took off (HP and shield)
    if(!u.alive&&T.on.kill&&o.alive) run(T,o,'kill',{u:o,src:o,tgt:u,dot:d,overkill:0,viaDot:true}); }
  /* between waves (the page's per-wave reset): 'waveEnd' now; the new wave's start is run on the unit's next tick, when the field is set */
  function wave(u){ const T=u._tal, s=T.s; if(s.fresh) return; if(u.alive&&T.on.waveEnd) run(T,u,'waveEnd',{u}); s.fresh=true; }
  function startWave(T,u){ const s=T.s; s.wave++;
    for(const k in s.k){ const d=T.st[k]; if(d&&d.wave==='reset') s.k[k].n=0; }
    for(const k in s.w) if(s.w[k].wave) s.w[k].t=0;
    if(T.on.wave) run(T,u,'wave',{u,tgt:u.target}); }
  /* once a tick per talented living unit, after every unit has thought and moved */
  function tick(u,dt){ const T=u._tal, s=T.s;
    if(T.watch){ const U=E.units(); for(let i=0;i<U.length;i++){ const x=U[i], w=x._talW; if(!w) x._talW=[u]; else if(w.indexOf(u)<0) w.push(u); } }
    if(s.fresh){ s.fresh=false; startWave(T,u); }
    s.moved=(u.x!==u.px||u.y!==u.py);
    if(s.tm.length) tickMarks(T,u);
    zoneEnds(T,u); if(s.zc) zoneCatch(T,u);
    if(s.dq.length){ const now=E.now(); for(let i=0;i<s.dq.length;i++){ const q=s.dq[i]; if(now<q.t-1e-9) continue; s.dq.splice(i--,1); acts(T,u,q.list,q.ctx); } }   // what 'after' put off is due
    for(const k in s.w){ const w=s.w[k]; if(w.t>0&&w.t!==Infinity){ w.t-=dt; if(w.t<=1e-9){ w.t=0; if(T.on['end:'+k]) run(T,u,'end:'+k,{u,tgt:u.target}); } } }
    for(const k in s.k){ const st=s.k[k], d=T.st[k]; if(st.rf&&st.rf.length){ const now=E.now(); for(let i=0;i<st.rf.length;i++){ if(now<st.rf[i]-1e-9) continue; st.rf.splice(i--,1);   // a spent unit of a refilling pool is back
          if(stSet(T,u,k,st.n+1)>0&&d.refilled&&T.on[d.refilled]) run(T,u,d.refilled,{u,tgt:u}); } }
      if(!d||!(st.n>0)) continue;
      if(d.dur){ st.t-=dt; if(st.t<=1e-9){ st.n=0; continue; } }
      if(d.fade&&!(d.fade.unless&&ok(T,u,d.fade.unless,{u}))){ st.idle+=dt; if(st.idle>=d.fade.after+d.fade.every-1e-9){ st.idle-=d.fade.every; st.n=Math.max(0,st.n-(d.fade.lose||1)); } } }
    if(s.undy>0) s.undy=Math.max(0,s.undy-dt);
    if(T.on.tick) run(T,u,'tick',{u,tgt:u.target,dt});
    restat(T,u); auras(T,u,dt); }

  const API={stGet,stSet,stMax,winOn,markOf,setMark,clearMark,endMark,inZone,zoneOn,hasDot,countDots,pick,amtOf,cnt,hurt,control,run,acts,gap,buffOn,mineOf,ustGet,ustPut,eng:()=>E};
  /* A hook never lets an error out into the fight: it is counted (TalentFx.errors() - the tests require zero) and the hook answers as if the hero
     had no talent row there. An error is as deterministic as anything else here, so device and server still agree. Diagnostics only: nothing in a
     fight reads ERR. */
  const ERR={n:0,last:''};
  const guard=(f,dflt)=>function(){ try{ return f.apply(null,arguments); }catch(e){ ERR.n++; ERR.last=String((e&&e.stack)||e).slice(0,600); return dflt?dflt.apply(null,arguments):undefined; } };
  const RUNTIME={bind,bindMore,define,attach:guard(attach,()=>null),
    summon:guard(summon),sOut:guard(sOut,(x,t,amt)=>amt),sHit:guard(sHit),sGone:guard(sGone),sCc:guard(sCc,(by,t,f,dur)=>dur),pagePre:guard(pagePre),page:guard(page),pageW0:guard(pageW0),pageW:guard(pageW),
    out:guard(out,(s,t,amt)=>amt),inc:guard(inc,(t,s,amt)=>amt),crit:guard(crit,(s,t,pre)=>pre),hit:guard(hit),lethal:guard(lethal),death:guard(death),heal:guard(heal),
    kit:guard(kit,(u,type,o)=>o),cast:guard(cast),healOut,hotPre:guard(hotPre,()=>null),hotPost:guard(hotPost,(t,h,k)=>{ if(k) h.hps=k.keep; }),num:guard(num,(u,n,v)=>v),ccHit:guard(ccHit),healIn:guard(healIn,(u,a)=>a),dodge:guard(dodge,()=>false),miss:guard(miss,()=>false),passPre:guard(passPre),pass:guard(pass),skillTgt:guard(skillTgt,(u,sk,m)=>m),at:guard(at),landPre:guard(landPre),land:guard(land),chill:guard(chill),teamLethal:guard(teamLethal),teamCc:guard(teamCc),nrgPre:guard(nrgPre),nrgIn:guard(nrgIn,u=>u.energy),cd:guard(cd,(u,slot,v)=>v),cc:guard(cc,(by,t,f,dur)=>dur),dotPre:guard(dotPre,(u,d)=>[d.dps]),dotPost:guard(dotPost),wave:guard(wave),tick:guard(tick),
    errors:()=>({n:ERR.n,last:ERR.last}), errorsReset:()=>{ ERR.n=0; ERR.last=''; },
    mech:hero=>defOf(hero)||null, mechHeroes:()=>Object.keys(MECH)};

  return Object.freeze(Object.assign({v:DATA.v,totals,applyStats,applyCore,has},RUNTIME));
});
